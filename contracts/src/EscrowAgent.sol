// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title EscrowAgent
/// @notice Holds USDT for a peer-to-peer trade agreed in a chat (Telegram, WhatsApp...) until
///         both sides are happy. The buyer locks the money, the seller accepts and delivers,
///         the buyer confirms and the seller is paid. Every exit path is spelled out below and
///         nobody, including the owner, can move a deal's money any other way.
contract EscrowAgent is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Funded, // buyer locked USDT, waiting for the seller to accept
        Accepted, // seller committed to the trade
        Delivered, // seller says the goods/service were handed over
        Disputed, // one side asked the arbiter to step in
        Released, // seller paid
        Refunded, // buyer got everything back
        Resolved // arbiter split the money
    }

    struct Deal {
        address buyer;
        uint64 createdAt;
        uint64 acceptBy; // seller must accept before this, otherwise the buyer can reclaim
        address seller;
        uint64 acceptedAt;
        uint64 deliveredAt;
        uint128 amount; // USDT, 6 decimals
        uint16 feeBps; // fee rate frozen when the deal is created
        Status status;
        bool buyerWantsCancel;
        bool sellerWantsCancel;
        uint64 closedAt;
        address disputedBy;
        string terms;
    }

    /// @notice Highest fee rate the owner can ever set: 1%.
    uint16 public constant MAX_FEE_BPS = 100;
    /// @notice A single deal never pays more than 5 USDT in fees, however big it is.
    uint256 public constant FEE_CAP = 5e6;
    /// @notice Smallest deal: 0.10 USDT, so people can try it with pocket change.
    uint256 public constant MIN_AMOUNT = 1e5;
    /// @notice How long the buyer has to object after the seller marks a deal delivered.
    uint256 public constant REVIEW_WINDOW = 3 days;
    uint256 public constant MIN_ACCEPT_WINDOW = 1 hours;
    uint256 public constant MAX_ACCEPT_WINDOW = 60 days;
    uint256 public constant MAX_TERMS_LENGTH = 280;

    IERC20 public immutable usdt;
    /// @notice Settles disputes. Fixed at deploy so it can't be swapped for a friendlier one later.
    address public immutable arbiter;

    address public treasury;
    uint16 public feeBps;

    uint256 public dealCount;
    uint256 public totalVolume;

    mapping(uint256 => Deal) private _deals;
    mapping(address => uint256[]) private _buying;
    mapping(address => uint256[]) private _selling;
    /// @notice Deals an address finished as seller with the buyer's approval. Used as a trust signal.
    mapping(address => uint256) public completedAsSeller;
    mapping(address => uint256) public completedAsBuyer;

    event DealCreated(
        uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount, uint64 acceptBy, string terms
    );
    event DealAccepted(uint256 indexed id);
    event DealDeclined(uint256 indexed id);
    event DealDelivered(uint256 indexed id);
    event DealReleased(uint256 indexed id, uint256 toSeller, uint256 fee, bool autoReleased);
    event DealRefunded(uint256 indexed id, uint256 amount, string reason);
    event CancelRequested(uint256 indexed id, address indexed by);
    event DisputeRaised(uint256 indexed id, address indexed by);
    event DisputeResolved(uint256 indexed id, uint256 toBuyer, uint256 toSeller, uint256 fee);
    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);

    error ZeroAddress();
    error SelfDeal();
    error AmountTooSmall();
    error AmountTooLarge();
    error BadDeadline();
    error TermsTooLong();
    error FeeTooHigh();
    error UnknownDeal();
    error NotBuyer();
    error NotSeller();
    error NotParty();
    error NotArbiter();
    error WrongStatus(Status current);
    error AcceptWindowClosed();
    error AcceptWindowOpen();
    error ReviewWindowOpen();
    error ReviewWindowClosed();
    error SplitTooLarge();
    error ArbiterCannotTrade();

    constructor(IERC20 usdt_, address arbiter_, address treasury_, uint16 feeBps_, address owner_)
        Ownable(owner_)
    {
        if (address(usdt_) == address(0) || arbiter_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        usdt = usdt_;
        arbiter = arbiter_;
        treasury = treasury_;
        feeBps = feeBps_;
    }

    // ------------------------------------------------------------------ buyer opens a deal

    /// @notice Lock `amount` USDT for `seller`. Approve this contract for `amount` first.
    /// @param acceptBy Unix time by which the seller has to accept.
    function createDeal(address seller, uint256 amount, uint64 acceptBy, string calldata terms)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (seller == address(0)) revert ZeroAddress();
        if (seller == msg.sender) revert SelfDeal();
        if (seller == arbiter || msg.sender == arbiter) revert ArbiterCannotTrade();
        if (amount < MIN_AMOUNT) revert AmountTooSmall();
        if (amount > type(uint128).max) revert AmountTooLarge();
        if (acceptBy < block.timestamp + MIN_ACCEPT_WINDOW || acceptBy > block.timestamp + MAX_ACCEPT_WINDOW) {
            revert BadDeadline();
        }
        if (bytes(terms).length > MAX_TERMS_LENGTH) revert TermsTooLong();

        id = ++dealCount;
        Deal storage d = _deals[id];
        d.buyer = msg.sender;
        d.seller = seller;
        d.amount = uint128(amount);
        d.feeBps = feeBps;
        d.createdAt = uint64(block.timestamp);
        d.acceptBy = acceptBy;
        d.status = Status.Funded;
        d.terms = terms;

        _buying[msg.sender].push(id);
        _selling[seller].push(id);

        usdt.safeTransferFrom(msg.sender, address(this), amount);
        emit DealCreated(id, msg.sender, seller, amount, acceptBy, terms);
    }

    // ------------------------------------------------------------------ seller side

    function acceptDeal(uint256 id) external {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotSeller();
        _expect(d, Status.Funded);
        if (block.timestamp > d.acceptBy) revert AcceptWindowClosed();
        d.status = Status.Accepted;
        d.acceptedAt = uint64(block.timestamp);
        emit DealAccepted(id);
    }

    /// @notice Seller turns the deal down. The buyer is refunded in full straight away.
    function declineDeal(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotSeller();
        _expect(d, Status.Funded);
        emit DealDeclined(id);
        _refund(id, d, "declined");
    }

    function markDelivered(uint256 id) external {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotSeller();
        _expect(d, Status.Accepted);
        d.status = Status.Delivered;
        d.deliveredAt = uint64(block.timestamp);
        emit DealDelivered(id);
    }

    /// @notice Seller can always hand the full amount back, at any stage before the deal closes.
    function refundBuyer(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotSeller();
        if (!_isOpen(d.status)) revert WrongStatus(d.status);
        _refund(id, d, "seller refund");
    }

    /// @notice If the buyer goes quiet after delivery, the seller collects once the review window passes.
    function claimAfterReview(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotSeller();
        _expect(d, Status.Delivered);
        if (block.timestamp < uint256(d.deliveredAt) + REVIEW_WINDOW) revert ReviewWindowOpen();
        _release(id, d, true);
    }

    // ------------------------------------------------------------------ buyer side

    /// @notice Buyer is happy: pay the seller. Works once the seller has accepted.
    function confirmReceipt(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotBuyer();
        if (d.status != Status.Accepted && d.status != Status.Delivered) revert WrongStatus(d.status);
        completedAsBuyer[d.buyer] += 1;
        completedAsSeller[d.seller] += 1;
        _release(id, d, false);
    }

    /// @notice Seller never accepted in time: buyer takes the money back.
    function reclaimExpired(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotBuyer();
        _expect(d, Status.Funded);
        if (block.timestamp <= d.acceptBy) revert AcceptWindowOpen();
        _refund(id, d, "expired");
    }

    /// @notice Before the seller accepts, the buyer can withdraw the offer on their own.
    function withdrawOffer(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotBuyer();
        _expect(d, Status.Funded);
        _refund(id, d, "withdrawn");
    }

    // ------------------------------------------------------------------ either party

    /// @notice Ask to call the deal off. When both sides have asked, the buyer is refunded in full.
    function requestCancel(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        Status s = d.status;
        if (s != Status.Accepted && s != Status.Delivered && s != Status.Disputed) revert WrongStatus(s);
        if (msg.sender == d.buyer) d.buyerWantsCancel = true;
        else if (msg.sender == d.seller) d.sellerWantsCancel = true;
        else revert NotParty();
        emit CancelRequested(id, msg.sender);
        if (d.buyerWantsCancel && d.sellerWantsCancel) _refund(id, d, "mutual cancel");
    }

    function raiseDispute(uint256 id) external {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer && msg.sender != d.seller) revert NotParty();
        if (d.status != Status.Accepted && d.status != Status.Delivered) revert WrongStatus(d.status);
        // Once the review window has passed the seller is entitled to claim, so disputes are closed.
        if (d.status == Status.Delivered && block.timestamp >= uint256(d.deliveredAt) + REVIEW_WINDOW) {
            revert ReviewWindowClosed();
        }
        d.status = Status.Disputed;
        d.disputedBy = msg.sender;
        emit DisputeRaised(id, msg.sender);
    }

    // ------------------------------------------------------------------ arbiter

    /// @notice Split a disputed deal. `toBuyer` goes back to the buyer, the rest goes to the seller
    ///         less the deal's fee on the seller's share.
    function resolveDispute(uint256 id, uint256 toBuyer) external nonReentrant {
        if (msg.sender != arbiter) revert NotArbiter();
        Deal storage d = _deal(id);
        _expect(d, Status.Disputed);
        uint256 amount = d.amount;
        if (toBuyer > amount) revert SplitTooLarge();
        uint256 sellerShare = amount - toBuyer;
        uint256 fee = _fee(sellerShare, d.feeBps);

        d.status = Status.Resolved;
        d.closedAt = uint64(block.timestamp);
        if (sellerShare > 0) totalVolume += sellerShare;

        if (toBuyer > 0) usdt.safeTransfer(d.buyer, toBuyer);
        if (sellerShare - fee > 0) usdt.safeTransfer(d.seller, sellerShare - fee);
        if (fee > 0) usdt.safeTransfer(treasury, fee);
        emit DisputeResolved(id, toBuyer, sellerShare - fee, fee);
    }

    // ------------------------------------------------------------------ owner (settings only)

    /// @notice Only affects deals created afterwards; open deals keep the rate they started with.
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    // ------------------------------------------------------------------ views

    function getDeal(uint256 id) external view returns (Deal memory) {
        if (id == 0 || id > dealCount) revert UnknownDeal();
        return _deals[id];
    }

    function dealsAsBuyer(address who) external view returns (uint256[] memory) {
        return _buying[who];
    }

    function dealsAsSeller(address who) external view returns (uint256[] memory) {
        return _selling[who];
    }

    /// @notice What the seller would receive and what the fee would be for a given amount right now.
    function quote(uint256 amount) external view returns (uint256 toSeller, uint256 fee) {
        fee = _fee(amount, feeBps);
        toSeller = amount - fee;
    }

    // ------------------------------------------------------------------ internals

    function _deal(uint256 id) private view returns (Deal storage d) {
        d = _deals[id];
        if (d.status == Status.None) revert UnknownDeal();
    }

    function _expect(Deal storage d, Status want) private view {
        if (d.status != want) revert WrongStatus(d.status);
    }

    function _isOpen(Status s) private pure returns (bool) {
        return s == Status.Funded || s == Status.Accepted || s == Status.Delivered || s == Status.Disputed;
    }

    function _fee(uint256 amount, uint16 bps) private pure returns (uint256 fee) {
        fee = (amount * bps) / 10_000;
        if (fee > FEE_CAP) fee = FEE_CAP;
    }

    function _release(uint256 id, Deal storage d, bool auto_) private {
        uint256 amount = d.amount;
        uint256 fee = _fee(amount, d.feeBps);
        d.status = Status.Released;
        d.closedAt = uint64(block.timestamp);
        totalVolume += amount;

        usdt.safeTransfer(d.seller, amount - fee);
        if (fee > 0) usdt.safeTransfer(treasury, fee);
        emit DealReleased(id, amount - fee, fee, auto_);
    }

    function _refund(uint256 id, Deal storage d, string memory reason) private {
        d.status = Status.Refunded;
        d.closedAt = uint64(block.timestamp);
        usdt.safeTransfer(d.buyer, d.amount);
        emit DealRefunded(id, d.amount, reason);
    }
}

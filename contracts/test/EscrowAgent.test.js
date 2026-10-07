const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const usdt = (n) => ethers.parseUnits(String(n), 6);
const HOUR = 3600;
const DAY = 24 * HOUR;

const S = { None: 0, Funded: 1, Accepted: 2, Delivered: 3, Disputed: 4, Released: 5, Refunded: 6, Resolved: 7 };

describe("EscrowAgent", function () {
  async function deploy() {
    const [owner, arbiter, treasury, buyer, seller, stranger] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("MockUSDT")).deploy();
    const escrow = await (
      await ethers.getContractFactory("EscrowAgent")
    ).deploy(await token.getAddress(), arbiter.address, treasury.address, 50, owner.address);

    for (const who of [buyer, seller, stranger]) {
      await token.mint(who.address, usdt(100_000));
      await token.connect(who).approve(await escrow.getAddress(), ethers.MaxUint256);
    }
    return { escrow, token, owner, arbiter, treasury, buyer, seller, stranger };
  }

  async function withDeal(amount = usdt(200)) {
    const f = await loadFixture(deploy);
    const acceptBy = (await time.latest()) + 2 * DAY;
    await f.escrow.connect(f.buyer).createDeal(f.seller.address, amount, acceptBy, "iPhone 13, 128GB, blue");
    return { ...f, id: 1n, amount, acceptBy };
  }

  async function accepted() {
    const f = await withDeal();
    await f.escrow.connect(f.seller).acceptDeal(f.id);
    return f;
  }

  async function delivered() {
    const f = await accepted();
    await f.escrow.connect(f.seller).markDelivered(f.id);
    return f;
  }

  async function disputed() {
    const f = await delivered();
    await f.escrow.connect(f.buyer).raiseDispute(f.id);
    return f;
  }

  describe("deployment", function () {
    it("stores its settings", async function () {
      const { escrow, token, owner, arbiter, treasury } = await loadFixture(deploy);
      expect(await escrow.usdt()).to.equal(await token.getAddress());
      expect(await escrow.arbiter()).to.equal(arbiter.address);
      expect(await escrow.treasury()).to.equal(treasury.address);
      expect(await escrow.feeBps()).to.equal(50);
      expect(await escrow.owner()).to.equal(owner.address);
    });

    it("rejects zero addresses and a fee above the ceiling", async function () {
      const [a] = await ethers.getSigners();
      const F = await ethers.getContractFactory("EscrowAgent");
      const zero = ethers.ZeroAddress;
      await expect(F.deploy(zero, a.address, a.address, 50, a.address)).to.be.revertedWithCustomError(F, "ZeroAddress");
      await expect(F.deploy(a.address, zero, a.address, 50, a.address)).to.be.revertedWithCustomError(F, "ZeroAddress");
      await expect(F.deploy(a.address, a.address, zero, 50, a.address)).to.be.revertedWithCustomError(F, "ZeroAddress");
      await expect(F.deploy(a.address, a.address, a.address, 101, a.address)).to.be.revertedWithCustomError(
        F,
        "FeeTooHigh"
      );
    });
  });

  describe("createDeal", function () {
    it("locks the buyer's USDT and records the deal", async function () {
      const { escrow, token, buyer, seller, id, amount, acceptBy } = await withDeal();
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
      const d = await escrow.getDeal(id);
      expect(d.buyer).to.equal(buyer.address);
      expect(d.seller).to.equal(seller.address);
      expect(d.amount).to.equal(amount);
      expect(d.acceptBy).to.equal(acceptBy);
      expect(d.status).to.equal(S.Funded);
      expect(d.feeBps).to.equal(50);
      expect(d.terms).to.equal("iPhone 13, 128GB, blue");
      expect(await escrow.dealCount()).to.equal(1);
      expect(await escrow.dealsAsBuyer(buyer.address)).to.deep.equal([1n]);
      expect(await escrow.dealsAsSeller(seller.address)).to.deep.equal([1n]);
    });

    it("emits DealCreated", async function () {
      const { escrow, buyer, seller } = await loadFixture(deploy);
      const acceptBy = (await time.latest()) + DAY;
      await expect(escrow.connect(buyer).createDeal(seller.address, usdt(5), acceptBy, "Logo design"))
        .to.emit(escrow, "DealCreated")
        .withArgs(1, buyer.address, seller.address, usdt(5), acceptBy, "Logo design");
    });

    it("validates every input", async function () {
      const { escrow, buyer, seller, arbiter } = await loadFixture(deploy);
      const now = await time.latest();
      const ok = now + DAY;
      const c = escrow.connect(buyer);
      await expect(c.createDeal(ethers.ZeroAddress, usdt(1), ok, "")).to.be.revertedWithCustomError(escrow, "ZeroAddress");
      await expect(c.createDeal(buyer.address, usdt(1), ok, "")).to.be.revertedWithCustomError(escrow, "SelfDeal");
      await expect(c.createDeal(arbiter.address, usdt(1), ok, "")).to.be.revertedWithCustomError(
        escrow,
        "ArbiterCannotTrade"
      );
      await expect(
        escrow.connect(arbiter).createDeal(seller.address, usdt(1), ok, "")
      ).to.be.revertedWithCustomError(escrow, "ArbiterCannotTrade");
      await expect(c.createDeal(seller.address, 99_999, ok, "")).to.be.revertedWithCustomError(escrow, "AmountTooSmall");
      await expect(c.createDeal(seller.address, 2n ** 128n, ok, "")).to.be.revertedWithCustomError(
        escrow,
        "AmountTooLarge"
      );
      await expect(c.createDeal(seller.address, usdt(1), now + 30 * 60, "")).to.be.revertedWithCustomError(
        escrow,
        "BadDeadline"
      );
      await expect(c.createDeal(seller.address, usdt(1), now + 61 * DAY, "")).to.be.revertedWithCustomError(
        escrow,
        "BadDeadline"
      );
      await expect(c.createDeal(seller.address, usdt(1), ok, "x".repeat(281))).to.be.revertedWithCustomError(
        escrow,
        "TermsTooLong"
      );
    });

    it("accepts the smallest amount and the longest terms", async function () {
      const { escrow, buyer, seller } = await loadFixture(deploy);
      const ok = (await time.latest()) + DAY;
      await expect(escrow.connect(buyer).createDeal(seller.address, 100_000, ok, "x".repeat(280))).to.not.be.reverted;
    });

    it("fails without allowance or balance", async function () {
      const { escrow, token, seller, stranger } = await loadFixture(deploy);
      const ok = (await time.latest()) + DAY;
      await token.connect(stranger).approve(await escrow.getAddress(), 0);
      await expect(escrow.connect(stranger).createDeal(seller.address, usdt(1), ok, "")).to.be.reverted;
      const [, , , , , , broke] = await ethers.getSigners();
      await token.connect(broke).approve(await escrow.getAddress(), ethers.MaxUint256);
      await expect(escrow.connect(broke).createDeal(seller.address, usdt(1), ok, "")).to.be.reverted;
    });

    it("freezes the fee rate on the deal", async function () {
      const { escrow, owner, id } = await withDeal();
      await escrow.connect(owner).setFeeBps(100);
      expect((await escrow.getDeal(id)).feeBps).to.equal(50);
    });
  });

  describe("happy path", function () {
    it("accept → deliver → confirm pays the seller minus the fee", async function () {
      const { escrow, token, buyer, seller, treasury, id, amount } = await delivered();
      const before = await token.balanceOf(seller.address);
      const fee = (amount * 50n) / 10_000n; // 1 USDT
      await expect(escrow.connect(buyer).confirmReceipt(id))
        .to.emit(escrow, "DealReleased")
        .withArgs(id, amount - fee, fee, false);
      expect(await token.balanceOf(seller.address)).to.equal(before + amount - fee);
      expect(await token.balanceOf(treasury.address)).to.equal(fee);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
      const d = await escrow.getDeal(id);
      expect(d.status).to.equal(S.Released);
      expect(d.closedAt).to.be.gt(0);
      expect(await escrow.completedAsSeller(seller.address)).to.equal(1);
      expect(await escrow.completedAsBuyer(buyer.address)).to.equal(1);
      expect(await escrow.totalVolume()).to.equal(amount);
    });

    it("buyer may confirm straight after acceptance (no delivery step)", async function () {
      const { escrow, buyer, id } = await accepted();
      await escrow.connect(buyer).confirmReceipt(id);
      expect((await escrow.getDeal(id)).status).to.equal(S.Released);
    });

    it("records timestamps along the way", async function () {
      const { escrow, id } = await delivered();
      const d = await escrow.getDeal(id);
      expect(d.createdAt).to.be.gt(0);
      expect(d.acceptedAt).to.be.gte(d.createdAt);
      expect(d.deliveredAt).to.be.gte(d.acceptedAt);
    });

    it("caps the fee at 5 USDT on big deals", async function () {
      const { escrow, token, buyer, seller, treasury } = await loadFixture(deploy);
      const amount = usdt(10_000); // 0.5% would be 50
      await escrow.connect(buyer).createDeal(seller.address, amount, (await time.latest()) + DAY, "Car deposit");
      await escrow.connect(seller).acceptDeal(1);
      await escrow.connect(buyer).confirmReceipt(1);
      expect(await token.balanceOf(treasury.address)).to.equal(usdt(5));
    });

    it("charges nothing when the fee is zero", async function () {
      const { escrow, token, owner, buyer, seller, treasury } = await loadFixture(deploy);
      await escrow.connect(owner).setFeeBps(0);
      await escrow.connect(buyer).createDeal(seller.address, usdt(10), (await time.latest()) + DAY, "");
      await escrow.connect(seller).acceptDeal(1);
      await escrow.connect(buyer).confirmReceipt(1);
      expect(await token.balanceOf(treasury.address)).to.equal(0);
    });

    it("quote matches the payout", async function () {
      const { escrow } = await loadFixture(deploy);
      const [toSeller, fee] = await escrow.quote(usdt(200));
      expect(fee).to.equal(usdt(1));
      expect(toSeller).to.equal(usdt(199));
      const [, bigFee] = await escrow.quote(usdt(1_000_000));
      expect(bigFee).to.equal(usdt(5));
    });
  });

  describe("seller actions", function () {
    it("only the seller can accept, deliver, decline, refund or claim", async function () {
      const { escrow, buyer, stranger, id } = await withDeal();
      for (const who of [buyer, stranger]) {
        await expect(escrow.connect(who).acceptDeal(id)).to.be.revertedWithCustomError(escrow, "NotSeller");
        await expect(escrow.connect(who).declineDeal(id)).to.be.revertedWithCustomError(escrow, "NotSeller");
        await expect(escrow.connect(who).markDelivered(id)).to.be.revertedWithCustomError(escrow, "NotSeller");
        await expect(escrow.connect(who).refundBuyer(id)).to.be.revertedWithCustomError(escrow, "NotSeller");
        await expect(escrow.connect(who).claimAfterReview(id)).to.be.revertedWithCustomError(escrow, "NotSeller");
      }
    });

    it("cannot accept after the deadline", async function () {
      const { escrow, seller, id, acceptBy } = await withDeal();
      await time.increaseTo(acceptBy + 1);
      await expect(escrow.connect(seller).acceptDeal(id)).to.be.revertedWithCustomError(escrow, "AcceptWindowClosed");
    });

    it("can accept exactly at the deadline", async function () {
      const { escrow, seller, id, acceptBy } = await withDeal();
      await time.setNextBlockTimestamp(acceptBy);
      await expect(escrow.connect(seller).acceptDeal(id)).to.emit(escrow, "DealAccepted").withArgs(id);
    });

    it("cannot accept twice or deliver before accepting", async function () {
      const { escrow, seller, id } = await withDeal();
      await expect(escrow.connect(seller).markDelivered(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Funded);
      await escrow.connect(seller).acceptDeal(id);
      await expect(escrow.connect(seller).acceptDeal(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Accepted);
    });

    it("declining refunds the buyer in full", async function () {
      const { escrow, token, buyer, seller, id, amount } = await withDeal();
      const before = await token.balanceOf(buyer.address);
      await expect(escrow.connect(seller).declineDeal(id))
        .to.emit(escrow, "DealDeclined")
        .and.to.emit(escrow, "DealRefunded")
        .withArgs(id, amount, "declined");
      expect(await token.balanceOf(buyer.address)).to.equal(before + amount);
      expect((await escrow.getDeal(id)).status).to.equal(S.Refunded);
    });

    it("cannot decline after accepting", async function () {
      const { escrow, seller, id } = await accepted();
      await expect(escrow.connect(seller).declineDeal(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    for (const [name, setup] of [
      ["Funded", withDeal],
      ["Accepted", accepted],
      ["Delivered", delivered],
      ["Disputed", disputed],
    ]) {
      it(`can refund the buyer in full while ${name}`, async function () {
        const { escrow, token, buyer, seller, id, amount } = await setup();
        const before = await token.balanceOf(buyer.address);
        await escrow.connect(seller).refundBuyer(id);
        expect(await token.balanceOf(buyer.address)).to.equal(before + amount);
      });
    }

    it("cannot refund a closed deal", async function () {
      const { escrow, buyer, seller, id } = await accepted();
      await escrow.connect(buyer).confirmReceipt(id);
      await expect(escrow.connect(seller).refundBuyer(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Released);
    });

    it("claims after the review window if the buyer goes quiet", async function () {
      const { escrow, token, seller, buyer, id, amount } = await delivered();
      await expect(escrow.connect(seller).claimAfterReview(id)).to.be.revertedWithCustomError(
        escrow,
        "ReviewWindowOpen"
      );
      await time.increase(3 * DAY);
      const before = await token.balanceOf(seller.address);
      await expect(escrow.connect(seller).claimAfterReview(id))
        .to.emit(escrow, "DealReleased")
        .withArgs(id, amount - usdt(1), usdt(1), true);
      expect(await token.balanceOf(seller.address)).to.equal(before + amount - usdt(1));
      // an auto-release is not counted as a buyer-approved completion
      expect(await escrow.completedAsSeller(seller.address)).to.equal(0);
      expect(await escrow.completedAsBuyer(buyer.address)).to.equal(0);
    });

    it("cannot claim before delivery", async function () {
      const { escrow, seller, id } = await accepted();
      await time.increase(10 * DAY);
      await expect(escrow.connect(seller).claimAfterReview(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });
  });

  describe("buyer actions", function () {
    it("only the buyer can confirm, reclaim or withdraw", async function () {
      const { escrow, seller, stranger, id } = await withDeal();
      for (const who of [seller, stranger]) {
        await expect(escrow.connect(who).confirmReceipt(id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
        await expect(escrow.connect(who).reclaimExpired(id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
        await expect(escrow.connect(who).withdrawOffer(id)).to.be.revertedWithCustomError(escrow, "NotBuyer");
      }
    });

    it("cannot confirm before the seller accepts", async function () {
      const { escrow, buyer, id } = await withDeal();
      await expect(escrow.connect(buyer).confirmReceipt(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Funded);
    });

    it("cannot confirm a disputed deal", async function () {
      const { escrow, buyer, id } = await disputed();
      await expect(escrow.connect(buyer).confirmReceipt(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Disputed);
    });

    it("cannot confirm twice", async function () {
      const { escrow, buyer, id } = await accepted();
      await escrow.connect(buyer).confirmReceipt(id);
      await expect(escrow.connect(buyer).confirmReceipt(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("reclaims only after the accept deadline passes", async function () {
      const { escrow, token, buyer, id, amount, acceptBy } = await withDeal();
      await expect(escrow.connect(buyer).reclaimExpired(id)).to.be.revertedWithCustomError(escrow, "AcceptWindowOpen");
      await time.increaseTo(acceptBy + 1);
      const before = await token.balanceOf(buyer.address);
      await expect(escrow.connect(buyer).reclaimExpired(id))
        .to.emit(escrow, "DealRefunded")
        .withArgs(id, amount, "expired");
      expect(await token.balanceOf(buyer.address)).to.equal(before + amount);
    });

    it("cannot reclaim once the seller accepted, even after the deadline", async function () {
      const { escrow, buyer, id, acceptBy } = await accepted();
      await time.increaseTo(acceptBy + DAY);
      await expect(escrow.connect(buyer).reclaimExpired(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("withdraws the offer before acceptance", async function () {
      const { escrow, token, buyer, id, amount } = await withDeal();
      const before = await token.balanceOf(buyer.address);
      await expect(escrow.connect(buyer).withdrawOffer(id))
        .to.emit(escrow, "DealRefunded")
        .withArgs(id, amount, "withdrawn");
      expect(await token.balanceOf(buyer.address)).to.equal(before + amount);
    });

    it("cannot withdraw once accepted", async function () {
      const { escrow, buyer, id } = await accepted();
      await expect(escrow.connect(buyer).withdrawOffer(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });
  });

  describe("mutual cancel", function () {
    it("refunds only when both sides ask", async function () {
      const { escrow, token, buyer, seller, id, amount } = await delivered();
      await expect(escrow.connect(buyer).requestCancel(id)).to.emit(escrow, "CancelRequested").withArgs(id, buyer.address);
      expect((await escrow.getDeal(id)).status).to.equal(S.Delivered);
      expect((await escrow.getDeal(id)).buyerWantsCancel).to.equal(true);
      const before = await token.balanceOf(buyer.address);
      await expect(escrow.connect(seller).requestCancel(id))
        .to.emit(escrow, "DealRefunded")
        .withArgs(id, amount, "mutual cancel");
      expect(await token.balanceOf(buyer.address)).to.equal(before + amount);
    });

    it("works while disputed", async function () {
      const { escrow, buyer, seller, id } = await disputed();
      await escrow.connect(seller).requestCancel(id);
      await escrow.connect(buyer).requestCancel(id);
      expect((await escrow.getDeal(id)).status).to.equal(S.Refunded);
    });

    it("asking twice from one side does nothing extra", async function () {
      const { escrow, buyer, id } = await accepted();
      await escrow.connect(buyer).requestCancel(id);
      await escrow.connect(buyer).requestCancel(id);
      expect((await escrow.getDeal(id)).status).to.equal(S.Accepted);
    });

    it("rejects outsiders and the wrong stage", async function () {
      const { escrow, buyer, stranger, id } = await withDeal();
      await expect(escrow.connect(buyer).requestCancel(id))
        .to.be.revertedWithCustomError(escrow, "WrongStatus")
        .withArgs(S.Funded);
      await escrow.connect(await ethers.getSigner((await escrow.getDeal(id)).seller)).acceptDeal(id);
      await expect(escrow.connect(stranger).requestCancel(id)).to.be.revertedWithCustomError(escrow, "NotParty");
    });
  });

  describe("disputes", function () {
    it("either party can raise one after acceptance", async function () {
      const a = await accepted();
      await expect(a.escrow.connect(a.seller).raiseDispute(a.id))
        .to.emit(a.escrow, "DisputeRaised")
        .withArgs(a.id, a.seller.address);
      const d = await a.escrow.getDeal(a.id);
      expect(d.status).to.equal(S.Disputed);
      expect(d.disputedBy).to.equal(a.seller.address);
    });

    it("cannot be raised before acceptance, by outsiders, or twice", async function () {
      const { escrow, buyer, seller, stranger, id } = await withDeal();
      await expect(escrow.connect(buyer).raiseDispute(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await escrow.connect(seller).acceptDeal(id);
      await expect(escrow.connect(stranger).raiseDispute(id)).to.be.revertedWithCustomError(escrow, "NotParty");
      await escrow.connect(buyer).raiseDispute(id);
      await expect(escrow.connect(seller).raiseDispute(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("closes once the review window has passed", async function () {
      const { escrow, buyer, id } = await delivered();
      await time.increase(3 * DAY);
      await expect(escrow.connect(buyer).raiseDispute(id)).to.be.revertedWithCustomError(escrow, "ReviewWindowClosed");
    });

    it("blocks the seller's auto-claim", async function () {
      const { escrow, seller, id } = await disputed();
      await time.increase(4 * DAY);
      await expect(escrow.connect(seller).claimAfterReview(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });

    it("only the arbiter resolves, and only disputed deals", async function () {
      const { escrow, owner, buyer, arbiter, id } = await accepted();
      await expect(escrow.connect(arbiter).resolveDispute(id, 0)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await escrow.connect(buyer).raiseDispute(id);
      for (const who of [owner, buyer]) {
        await expect(escrow.connect(who).resolveDispute(id, 0)).to.be.revertedWithCustomError(escrow, "NotArbiter");
      }
    });

    it("splits the money, fee only on the seller's share", async function () {
      const { escrow, token, arbiter, buyer, seller, treasury, id } = await disputed();
      const b0 = await token.balanceOf(buyer.address);
      const s0 = await token.balanceOf(seller.address);
      // 200 locked: 80 back to buyer, 120 to seller, fee 0.5% of 120 = 0.6
      await expect(escrow.connect(arbiter).resolveDispute(id, usdt(80)))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(id, usdt(80), usdt(119.4), usdt(0.6));
      expect(await token.balanceOf(buyer.address)).to.equal(b0 + usdt(80));
      expect(await token.balanceOf(seller.address)).to.equal(s0 + usdt(119.4));
      expect(await token.balanceOf(treasury.address)).to.equal(usdt(0.6));
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
      expect((await escrow.getDeal(id)).status).to.equal(S.Resolved);
    });

    it("can give everything to one side", async function () {
      const a = await disputed();
      await a.escrow.connect(a.arbiter).resolveDispute(a.id, a.amount);
      expect(await a.token.balanceOf(await a.escrow.getAddress())).to.equal(0);
      expect(await a.token.balanceOf(a.treasury.address)).to.equal(0);

      const b = await disputed();
      await b.escrow.connect(b.arbiter).resolveDispute(b.id, 0);
      expect(await b.token.balanceOf(b.treasury.address)).to.equal(usdt(1));
    });

    it("rejects a split bigger than the deal", async function () {
      const { escrow, arbiter, id, amount } = await disputed();
      await expect(escrow.connect(arbiter).resolveDispute(id, amount + 1n)).to.be.revertedWithCustomError(
        escrow,
        "SplitTooLarge"
      );
    });
  });

  describe("owner", function () {
    it("can change the fee within the ceiling and the treasury", async function () {
      const { escrow, owner, stranger } = await loadFixture(deploy);
      await expect(escrow.connect(owner).setFeeBps(100)).to.emit(escrow, "FeeUpdated").withArgs(100);
      await expect(escrow.connect(owner).setFeeBps(101)).to.be.revertedWithCustomError(escrow, "FeeTooHigh");
      await expect(escrow.connect(owner).setTreasury(stranger.address))
        .to.emit(escrow, "TreasuryUpdated")
        .withArgs(stranger.address);
      await expect(escrow.connect(owner).setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        escrow,
        "ZeroAddress"
      );
    });

    it("non-owners cannot change settings", async function () {
      const { escrow, stranger } = await loadFixture(deploy);
      await expect(escrow.connect(stranger).setFeeBps(10)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
      await expect(escrow.connect(stranger).setTreasury(stranger.address)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });

    it("has no way to move deal money", async function () {
      const { escrow } = await loadFixture(deploy);
      const fns = escrow.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
      for (const banned of ["withdraw", "sweep", "rescue", "emergencyWithdraw", "setArbiter", "pause"]) {
        expect(fns).to.not.include(banned);
      }
    });
  });

  describe("views and bookkeeping", function () {
    it("unknown deals revert", async function () {
      const { escrow, seller } = await loadFixture(deploy);
      await expect(escrow.getDeal(0)).to.be.revertedWithCustomError(escrow, "UnknownDeal");
      await expect(escrow.getDeal(1)).to.be.revertedWithCustomError(escrow, "UnknownDeal");
      await expect(escrow.connect(seller).acceptDeal(7)).to.be.revertedWithCustomError(escrow, "UnknownDeal");
    });

    it("tracks many deals per person and keeps balances separate", async function () {
      const { escrow, token, buyer, seller, stranger } = await loadFixture(deploy);
      const t = (await time.latest()) + DAY;
      await escrow.connect(buyer).createDeal(seller.address, usdt(10), t, "a");
      await escrow.connect(buyer).createDeal(stranger.address, usdt(20), t, "b");
      await escrow.connect(stranger).createDeal(buyer.address, usdt(30), t, "c");
      expect(await escrow.dealsAsBuyer(buyer.address)).to.deep.equal([1n, 2n]);
      expect(await escrow.dealsAsSeller(buyer.address)).to.deep.equal([3n]);
      expect(await escrow.dealsAsSeller(stranger.address)).to.deep.equal([2n]);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(usdt(60));

      await escrow.connect(seller).declineDeal(1);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(usdt(50));
      expect((await escrow.getDeal(2)).status).to.equal(S.Funded);
    });

    it("closed deals cannot be touched again", async function () {
      const { escrow, buyer, seller, arbiter, id } = await withDeal();
      await escrow.connect(buyer).withdrawOffer(id);
      await expect(escrow.connect(seller).acceptDeal(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await expect(escrow.connect(buyer).withdrawOffer(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await expect(escrow.connect(buyer).raiseDispute(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await expect(escrow.connect(arbiter).resolveDispute(id, 0)).to.be.revertedWithCustomError(escrow, "WrongStatus");
      await expect(escrow.connect(buyer).requestCancel(id)).to.be.revertedWithCustomError(escrow, "WrongStatus");
    });
  });
});

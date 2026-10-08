# EscrowAgent

Escrow for Telegram and WhatsApp P2P trades. Funds are held on-chain in USDT until both parties confirm.

Built for the 45-in-90 BOT Chain Challenge.
Chain: BOT Chain Testnet/Mainnet
Tech: Next.js, Solidity, Wagmi, Tailwind

**Live app:** https://escrow-agent.vercel.app · **Testnet contract:** [`0x12f5e627A044B633C408979743b846961aCA4cA6`](https://scan.bohr.life/address/0x12f5e627A044B633C408979743b846961aCA4cA6#code)

---

## The problem

Most small trades in Nigeria start in a chat: a phone on a WhatsApp status, a logo job in a Telegram group, a
PS5 pad from someone on Twitter. The trade nearly always stalls on the same question: *who sends first?*
If the buyer pays first, they can be ghosted. If the seller ships first, they can be ghosted. Middlemen
charge a lot and are just another stranger to trust.

## How it works

1. **Buyer locks USDT.** They paste the seller's address, the price, a short description and a deadline to
   accept. The USDT moves into the EscrowAgent contract, not to anyone's wallet.
2. **Share the link.** One tap sends the deal page to WhatsApp (`wa.me`) or Telegram (`t.me/share`). The
   seller sees for themselves that the money is really locked.
3. **Seller accepts, delivers and marks it delivered.**
4. **Buyer confirms.** The seller receives the USDT minus a small fee (0.5%, never more than 5 USDT).

Sellers can also make a **pay-in-escrow link** that opens the form already filled in with their address,
price and item, so the buyer only has to press lock.

## Safety guarantees

Locked USDT can leave the contract in exactly three ways, and nobody can move it any other way. That includes the owner.

| Exit | When |
| --- | --- |
| **To the seller** | The buyer confirms, or the seller marked it delivered and the buyer raised nothing for 3 days |
| **Back to the buyer** | The seller declines, doesn't accept before the deadline, refunds on their own, the buyer withdraws before acceptance, or both sides agree to cancel |
| **Split by the arbiter** | Only after the buyer or seller raises a dispute |

- The arbiter is set once at deploy (`immutable`) and cannot buy or sell through the contract.
- The fee rate is frozen per deal when it is created. The owner can change it for future deals, never above 1%.
- There is no withdraw, sweep, pause or upgrade function.
- Every money-moving function is `nonReentrant` and uses `SafeERC20`.

## Deal Assistant

Rule-based checks that run in the browser using on-chain history, with no API and no data sent anywhere:

- seller is a brand-new address, a contract, or has no completed sales here
- large amounts (suggests a small test deal first)
- very short or very long deadlines
- vague terms, or phrases common in P2P scams (“urgent”, “send first”, gift cards, airtime)
- on a live deal: what to do next, how long is left to review, when not to ship yet

Amounts are also shown in naira, using the free `open.er-api.com` USD→NGN rate.

## Contract API

`EscrowAgent.sol` (Solidity 0.8.24, OpenZeppelin 5)

| Function | Who | Does |
| --- | --- | --- |
| `createDeal(seller, amount, acceptBy, terms)` | buyer | Locks `amount` USDT (approve first). Min 0.10 USDT, deadline 1 h–60 d, terms ≤ 280 chars |
| `acceptDeal(id)` | seller | Commits to the deal before `acceptBy` |
| `declineDeal(id)` | seller | Turns it down, full refund to buyer |
| `markDelivered(id)` | seller | Starts the 3-day review window |
| `confirmReceipt(id)` | buyer | Pays the seller (after acceptance) |
| `claimAfterReview(id)` | seller | Collects if the buyer stayed silent for 3 days after delivery |
| `refundBuyer(id)` | seller | Full refund at any open stage |
| `withdrawOffer(id)` | buyer | Full refund before the seller accepts |
| `reclaimExpired(id)` | buyer | Full refund after the accept deadline passes |
| `requestCancel(id)` | either | Full refund once both sides have asked |
| `raiseDispute(id)` | either | Freezes the deal for the arbiter |
| `resolveDispute(id, toBuyer)` | arbiter | Splits a disputed deal; fee only on the seller's share |
| `setFeeBps(bps)` / `setTreasury(addr)` | owner | Settings for future deals only |
| `getDeal`, `dealsAsBuyer`, `dealsAsSeller`, `quote`, `completedAsSeller`, `completedAsBuyer` | anyone | Views |

## Networks

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 677 | 968 |
| RPC | https://rpc.botchain.ai | https://rpc.bohr.life |
| Explorer | https://scan.botchain.ai | https://scan.bohr.life |
| USDT (6 decimals) | `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C` | `0x75edC9335175Fc0552D51D48439F229c10420fe3` |

USDT is the only stablecoin on BOT Chain. Testnet tBOT and USDT come from https://faucet.botchain.ai/en/basic.

> MetaMask may show “network details don't match” when adding the testnet, because chain ID 968 is also
> listed for another chain on chainlist. It's safe to continue for `rpc.bohr.life`.

## Run it

```bash
# contracts
cd contracts
npm install
npx hardhat test
cp .env.example .env          # fill in PRIVATE_KEY, OWNER, ARBITER
npm run deploy:testnet        # writes the address + ABI into web/src/lib/contract.ts
npm run seed:testnet          # optional demo deals (testnet only)

# web
cd ../web
npm install
npm run dev
```

The frontend follows whichever chain the contract was last deployed to. To settle a dispute from the
command line: `DEAL=4 TO_BUYER=25 npx hardhat run scripts/resolve.js --network botchainMainnet`
(the arbiter can also do it from the deal page).

## Design

- **Mood:** light, editorial fintech. Lots of white space, one confident blue (`#2467e3`) for actions, ink
  text (`#1b1f28`) and a soft blush surface (`#fff5fb`) for the “your money is safe” moments. No gradients
  or glass.
- **Dark mode:** a warm charcoal theme (`#141413` page, `#1c1c1a` cards) that keeps the same blue. It follows
  the device setting by default; the header button switches between device, light and dark. An inline script
  applies the choice before the first paint, so there's no white flash. Every colour is a CSS token, so the
  dark theme only swaps values.
- **Type:** Hanken Grotesk for everything, set large and tight for headlines. IBM Plex Mono for addresses,
  block numbers and links.
- **Shape:** 12px buttons with a soft inset highlight, 28px rounded cards, thin borders, almost no shadows.
- **Layout:** split hero with the create form on the right, so the first action is always on screen; a drawn
  chat that shows how a deal link lands in a conversation; a two-column deal page with progress on the left
  and only the actions that apply to *you* on the right.
- **Logo:** a padlock whose body is a chat bubble, meaning money locked inside the conversation.

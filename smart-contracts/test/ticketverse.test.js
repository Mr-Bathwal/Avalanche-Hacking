const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TicketVerse", function () {
  let owner, organizer, buyer, buyer2;
  let verifier, factory, marketplace, eventTicket, eventAddr;

  const ONE = ethers.parseEther("1");

  function buildParams(now) {
    return [
      "Demo Event", // name
      "DEMO", // symbol
      100n, // maxSupply
      ONE, // baseMintPrice (1 AVAX)
      7000n, // organizerPercentage (bps)
      500n, // royaltyFeePercentage (bps => 5%)
      BigInt(now + 3600), // eventStartTime
      BigInt(now + 7200), // eventEndTime
      5n, // maxMints per user
      [10n, 1n, 5n, 0n, true], // vipConfig: total, seatStart, seatEnd, holding(0), enabled
      ethers.parseEther("2"), // vipMintPrice
      false, // waitlistEnabled
      0n, // whitelistDuration
      [], // initialWhitelist
      "Stadium A", // venue
      "A great show", // description
      100n, // seatCount
      "ipfs://vip/", // vipTokenURI
      "ipfs://reg/", // nonVipTokenURI
    ];
  }

  beforeEach(async function () {
    [owner, organizer, buyer, buyer2] = await ethers.getSigners();

    verifier = await (await ethers.getContractFactory("UserVerifier")).deploy();
    factory = await (
      await ethers.getContractFactory("EventFactory")
    ).deploy(0, await verifier.getAddress());
    marketplace = await (await ethers.getContractFactory("TicketMarketplace")).deploy();

    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await factory.connect(organizer).createEvent(buildParams(now));
    [eventAddr] = await factory.getAllDeployedEvents();
    eventTicket = await ethers.getContractAt("EventTicket", eventAddr);
  });

  it("deploys one event per createEvent and tracks organizer events", async function () {
    expect(await factory.getTotalEventsCreated()).to.equal(1n);
    const orgEvents = await factory.getAllOrganizerEvents(organizer.address);
    expect(orgEvents[0]).to.equal(eventAddr);
    expect(await eventTicket.eventOrganizer()).to.equal(organizer.address);
    expect(await eventTicket.venue()).to.equal("Stadium A");
  });

  it("mints a ticket with correct seat, tier and price", async function () {
    // seat 10 is outside VIP range 1..5 -> normal, 1 AVAX
    await eventTicket.connect(buyer).mintTicket("Demo Event", 10, { value: ONE });
    expect(await eventTicket.ownerOf(0)).to.equal(buyer.address);
    const t = await eventTicket.getTicketInfo(0);
    expect(t.seatNumber).to.equal(10n);
    expect(t.isVIP).to.equal(false);
    expect(t.pricePaid).to.equal(ONE);
    expect(await eventTicket.seatMinted(10)).to.equal(true);

    // VIP seat (3) costs vipMintPrice (2 AVAX)
    await eventTicket
      .connect(buyer2)
      .mintTicket("Demo Event", 3, { value: ethers.parseEther("2") });
    const vipTicket = await eventTicket.getTicketInfo(1);
    expect(vipTicket.isVIP).to.equal(true);
  });

  it("rejects a double-mint of the same seat", async function () {
    await eventTicket.connect(buyer).mintTicket("Demo Event", 10, { value: ONE });
    await expect(
      eventTicket.connect(buyer2).mintTicket("Demo Event", 10, { value: ONE })
    ).to.be.revertedWith("seat taken");
  });

  it("enforces the +20% anti-scalping cap on resale", async function () {
    await eventTicket.connect(buyer).mintTicket("Demo Event", 10, { value: ONE });
    await eventTicket.connect(buyer).setApprovalForAll(await marketplace.getAddress(), true);

    // 1.3 AVAX = +30% over the 1 AVAX mint price -> rejected
    await expect(
      marketplace.connect(buyer).listItemFixedPrice(eventAddr, 0, ethers.parseEther("1.3"))
    ).to.be.revertedWith("exceeds +20% cap");

    // 1.2 AVAX = +20% exactly -> allowed, NFT escrowed
    await marketplace.connect(buyer).listItemFixedPrice(eventAddr, 0, ethers.parseEther("1.2"));
    expect(await eventTicket.ownerOf(0)).to.equal(await marketplace.getAddress());
  });

  it("settles a deposit-based purchase and splits royalty to the organizer", async function () {
    await eventTicket.connect(buyer).mintTicket("Demo Event", 10, { value: ONE });
    await eventTicket.connect(buyer).setApprovalForAll(await marketplace.getAddress(), true);
    await marketplace.connect(buyer).listItemFixedPrice(eventAddr, 0, ethers.parseEther("1.2"));

    // buyer2 deposits and buys
    await marketplace
      .connect(buyer2)
      .depositForEvent(eventAddr, { value: ethers.parseEther("1.2") });
    await marketplace.connect(buyer2).buyItemWithDeposits(eventAddr, 0);

    expect(await eventTicket.ownerOf(0)).to.equal(buyer2.address);

    // seller (buyer) gets 95%, organizer royalty 5%
    const sellerBal = await marketplace.getUserBalance(buyer.address, eventAddr);
    const orgBal = await marketplace.getUserBalance(organizer.address, eventAddr);
    expect(sellerBal.availableBalance).to.equal(ethers.parseEther("1.14"));
    expect(orgBal.availableBalance).to.equal(ethers.parseEther("0.06"));
  });

  it("verifies users and reports status", async function () {
    await verifier.connect(buyer).verifyUser(buyer.address);
    expect(await verifier.isVerifiedAndActive(buyer.address)).to.equal(true);
    const status = await verifier.getUserStatus(buyer.address);
    expect(status.isVerified).to.equal(true);
    expect(status.level).to.equal(1n); // Basic
  });
});

const { expect } = require("chai");

describe("HalveningReleaseSchedule", () => {
  let deployer;
  let otherUser;

  let scheduleCurrent;
  let scheduleCurrentAddress;
  let scheduleOld;
  let scheduleOldAddress;
  let ScheduleFactory;

  let startTimeCurrent;
  let startTimeOld;

  const ONE_WEEK = 86400 * 7;
  const WEEKS_27 = ONE_WEEK * 27;
  const CYCLE_DURATION = ONE_WEEK * 26; // 26 weeks

  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    otherUser = signers[1];

    ScheduleFactory = await ethers.getContractFactory('TestReleaseSchedule');

    startTimeCurrent = Math.floor(Date.now() / 1000) - 100;
    startTimeOld = Math.floor(Date.now() / 1000) - WEEKS_27;

    scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeCurrent);
    await scheduleCurrent.deployed();
    scheduleCurrentAddress = scheduleCurrent.address;

    scheduleOld = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeOld);
    await scheduleOld.deployed();
    scheduleOldAddress = scheduleOld.address;
  });
  
  describe("#getCurrentCycle", () => {
    it("current timestamp", async () => {
        const index = await scheduleCurrent.getCurrentCycle();
        expect(index).to.equal(1);
    });

    it("one cycle elapsed", async () => {
        const index = await scheduleOld.getCurrentCycle();
        expect(index).to.equal(2);
    });
  });

  describe("#getTokensForCycle", () => {
    it("first cycle", async () => {
        const numberOfTokens = await scheduleCurrent.getTokensForCycle(1);
        expect(numberOfTokens).to.equal(CYCLE_DURATION * 4);
    });

    it("third cycle", async () => {
        const numberOfTokens = await scheduleCurrent.getTokensForCycle(3);
        expect(numberOfTokens).to.equal(CYCLE_DURATION);
    });
  });

  describe("#getStartOfCycle", () => {
    it("first cycle", async () => {
        const start = await scheduleCurrent.getStartOfCycle(1);
        expect(start).to.equal(startTimeCurrent);
    });

    it("second cycle", async () => {
        const start = await scheduleCurrent.getStartOfCycle(2);
        expect(start).to.equal(startTimeCurrent + CYCLE_DURATION);
    });

    it("third cycle", async () => {
        const start = await scheduleCurrent.getStartOfCycle(3);
        expect(start).to.equal(startTimeCurrent + CYCLE_DURATION + CYCLE_DURATION);
    });
  });
  
  describe("#getRewardRate", () => {
    it("first cycle", async () => {
        const rate = await scheduleCurrent.getRewardRate(1);
        expect(rate).to.equal(4);
    });

    it("third cycle", async () => {
        const rate = await scheduleCurrent.getRewardRate(3);
        expect(rate).to.equal(1);
    });
  });

  describe("#getCurrentRewardRate", () => {
    it("zero cycles elapsed", async () => {
        const rate = await scheduleCurrent.getCurrentRewardRate();
        expect(rate).to.equal(4);
    });

    it("one cycle elapsed", async () => {
        const rate = await scheduleOld.getCurrentRewardRate();
        expect(rate).to.equal(2);
    });
  });

  describe("#getStartOfCurrentCycle", () => {
    it("zero cycles elapsed", async () => {
        const start = await scheduleCurrent.getStartOfCurrentCycle();
        expect(start).to.equal(startTimeCurrent);
    });

    it("one cycle elapsed", async () => {
        const start = await scheduleOld.getStartOfCurrentCycle();
        expect(start).to.equal(startTimeOld + CYCLE_DURATION);
    });
  });

  describe("#availableRewards", () => {
    it("0 total weight in current period and period index is 0", async () => {
      let availableTokens = await scheduleCurrent.availableRewards(0);
      expect(availableTokens).to.equal(0);
    });

    it("one cycle", async () => {
      let current = Math.floor(Date.now() / 1000);
      scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - 100);
      await scheduleCurrent.deployed();
      scheduleCurrentAddress = scheduleCurrent.address;
      let availableTokens = await scheduleCurrent.availableRewards(current - 50);
      expect(availableTokens).to.equal(200);
    });

    it("cross cycle", async () => {
      let current = Math.floor(Date.now() / 1000);
      scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, current - WEEKS_27 - 100);
      await scheduleCurrent.deployed();
      scheduleCurrentAddress = scheduleCurrent.address;
      let availableTokens = await scheduleCurrent.availableRewards(current - WEEKS_27);
      expect(availableTokens).to.equal((CYCLE_DURATION * 4) + (ONE_WEEK * 2) - 194);
    });
  });
});
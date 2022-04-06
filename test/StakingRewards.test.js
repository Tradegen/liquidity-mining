const { expect } = require("chai");
const { parseEther } = require("@ethersproject/units");

describe("StakingRewards", () => {
  let deployer;
  let otherUser;

  let scheduleCurrent;
  let scheduleCurrentAddress;
  let ScheduleFactory;

  let rewardToken;
  let rewardTokenAddress;
  let stakingToken;
  let stakingTokenAddress;
  let RewardTokenFactory;

  let releaseEscrowCurrent;
  let releaseEscrowCurrentAddress;
  let ReleaseEscrowFactory;

  let stakingRewards;
  let stakingRewardsAddress;
  let StakingRewardsFactory;

  let startTimeCurrent;
  let startTimeOld;
  let startTimeFuture;

  const WEEKS_27 = 86400 * 7 * 27;
  const CYCLE_DURATION = 86400 * 7 * 26; // 26 weeks
  
  before(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    otherUser = signers[1];

    ScheduleFactory = await ethers.getContractFactory('TestReleaseSchedule');
    RewardTokenFactory = await ethers.getContractFactory('TestTokenERC20');
    ReleaseEscrowFactory = await ethers.getContractFactory('TestReleaseEscrow');
    StakingRewardsFactory = await ethers.getContractFactory('StakingRewards');

    startTimeCurrent = Math.floor(Date.now() / 1000) - 100;
    startTimeOld = Math.floor(Date.now() / 1000) - WEEKS_27;
    startTimeFuture = Math.floor(Date.now() / 1000) + 10000;

    scheduleCurrent = await ScheduleFactory.deploy(CYCLE_DURATION * 4, startTimeCurrent);
    await scheduleCurrent.deployed();
    scheduleCurrentAddress = scheduleCurrent.address;

    rewardToken = await RewardTokenFactory.deploy("Reward Token", "TEST");
    await rewardToken.deployed();
    rewardTokenAddress = rewardToken.address;

    stakingToken = await RewardTokenFactory.deploy("Staking Token", "TEST2");
    await stakingToken.deployed();
    stakingTokenAddress = stakingToken.address;
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    deployer = signers[0];
    otherUser = signers[1];

    // Using scheduleCurrentAddress as xTGEN.
    stakingRewards = await StakingRewardsFactory.deploy(rewardTokenAddress, stakingTokenAddress, scheduleCurrentAddress);
    await stakingRewards.deployed();
    stakingRewardsAddress = stakingRewards.address;

    releaseEscrowCurrent = await ReleaseEscrowFactory.deploy(stakingRewardsAddress, rewardTokenAddress, scheduleCurrentAddress);
    await releaseEscrowCurrent.deployed();
    releaseEscrowCurrentAddress = releaseEscrowCurrent.address;

    // Transfer tokens to ReleaseEscrowCurrent
    let tx = await rewardToken.approve(releaseEscrowCurrentAddress, CYCLE_DURATION * 8);
    await tx.wait();
    let tx2 = await rewardToken.transfer(releaseEscrowCurrentAddress, CYCLE_DURATION * 8);
    await tx2.wait();
  });

  describe("#setReleaseEscrow", () => {
    it("not owner", async () => {
        let tx = stakingRewards.connect(otherUser).setReleaseEscrow(releaseEscrowCurrentAddress);
        await expect(tx).to.be.reverted;
    });

    it("meets requirements", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let address = await stakingRewards.releaseEscrow();
        expect(address).to.equal(releaseEscrowCurrentAddress);
    });

    it("release escrow is already set", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = stakingRewards.setReleaseEscrow(stakingTokenAddress);
        await expect(tx2).to.be.reverted;

        let address = await stakingRewards.releaseEscrow();
        expect(address).to.equal(releaseEscrowCurrentAddress);
    });
  });

  describe("#stake", () => {
    it("release escrow is not set", async () => {
        let tx = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx.wait();

        let tx2 = stakingRewards.stake(parseEther("1"));
        await expect(tx2).to.be.reverted;

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(0);

        let balanceOf = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOf).to.equal(0);
    });

    it("meets requirements; no other investors", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(parseEther("1"));

        let balanceOf = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOf).to.equal(parseEther("1"));
    });

    it("meets requirements; other investors", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let tx4 = await stakingToken.transfer(otherUser.address, parseEther("1"));
        await tx4.wait();

        let tx5 = await stakingToken.connect(otherUser).approve(stakingRewardsAddress, parseEther("1"));
        await tx5.wait();

        let tx6 = await stakingRewards.connect(otherUser).stake(parseEther("1"));
        await tx6.wait();

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(parseEther("2"));

        let balanceOfDeployer = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOfDeployer).to.equal(parseEther("1"));

        let balanceOfOther = await stakingRewards.balanceOf(otherUser.address);
        expect(balanceOfOther).to.equal(parseEther("1"));
    });

    it("stake multiple times without claiming rewards", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let current = await scheduleCurrent.currentTime();

        let tx4 = await releaseEscrowCurrent.setLastWithdrawalTime(Number(current) - 10000);
        await tx4.wait();

        let tx5 = await scheduleCurrent.setDistributionStartTime(Number(current) - 10000);
        await tx5.wait();

        let tx6 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx6.wait();

        let initialBalanceDeployer = await rewardToken.balanceOf(deployer.address);
        let initialBalanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        let initialBalanceContract = await rewardToken.balanceOf(stakingRewardsAddress);

        console.log(initialBalanceContract.toString());

        let tx7 = await stakingRewards.stake(parseEther("1"));
        await tx7.wait();

        let newBalanceContract = await rewardToken.balanceOf(stakingRewardsAddress);
        console.log(newBalanceContract.toString());

        let newBalanceStaking = await rewardToken.balanceOf(scheduleCurrentAddress);
        expect(newBalanceStaking).to.equal(initialBalanceStaking);

        let newBalanceDeployer = await rewardToken.balanceOf(deployer.address);
        expect(newBalanceDeployer).to.equal(initialBalanceDeployer); // Earned rewards but not transferred to user automatically.

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(parseEther("2"));

        let balanceOf = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOf).to.equal(parseEther("2"));

        let earned2 = await stakingRewards.earned(deployer.address);
        expect(earned2).to.equal(40016);

        let contractBalance = await rewardToken.balanceOf(stakingRewardsAddress);
        expect(contractBalance).to.equal(40016);

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(40016);
    });
  });

  describe("#withdraw", () => {
    it("release escrow is not set", async () => {
        let tx = stakingRewards.withdraw(parseEther("1"));
        await expect(tx).to.be.reverted;

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(0);

        let balanceOf = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOf).to.equal(0);
    });

    it("meets requirements; no other investors", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let tx4 = await stakingRewards.withdraw(parseEther("0.5"));
        await tx4.wait();

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(parseEther("0.5"));

        let balanceOf = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOf).to.equal(parseEther("0.5"));
    });

    it("meets requirements; other investors", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let tx4 = await stakingRewards.withdraw(parseEther("1"));
        await tx4.wait();

        let tx5 = await stakingToken.transfer(otherUser.address, parseEther("1"));
        await tx5.wait();

        let tx6 = await stakingToken.connect(otherUser).approve(stakingRewardsAddress, parseEther("1"));
        await tx6.wait();

        let tx7 = await stakingRewards.connect(otherUser).stake(parseEther("1"));
        await tx7.wait();

        let tx8 = await stakingRewards.connect(otherUser).withdraw(parseEther("0.5"));
        await tx8.wait();

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(parseEther("0.5"));

        let balanceOfDeployer = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOfDeployer).to.equal(0);

        let balanceOfOther = await stakingRewards.balanceOf(otherUser.address);
        expect(balanceOfOther).to.equal(parseEther("0.5"));
    });
  });

  describe("#getReward", () => {
    it("nothing staked", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let current = await scheduleCurrent.currentTime();

        let tx2 = await releaseEscrowCurrent.setLastWithdrawalTime(Number(current) - 10000);
        await tx2.wait();

        let initialBalance = await rewardToken.balanceOf(scheduleCurrentAddress);
        console.log(Number(initialBalance));

        let tx3 = await stakingRewards.getReward();
        await tx3.wait();

        let newBalance = await rewardToken.balanceOf(scheduleCurrentAddress);
        let expectedNewBalance = BigInt(initialBalance) + BigInt(40008);
        expect(newBalance.toString()).to.equal(expectedNewBalance.toString());
    });

    it("withdraw before claiming reward", async () => {
        let tx = await stakingRewards.setReleaseEscrow(releaseEscrowCurrentAddress);
        await tx.wait();

        let tx2 = await stakingToken.approve(stakingRewardsAddress, parseEther("1"));
        await tx2.wait();

        let tx3 = await stakingRewards.stake(parseEther("1"));
        await tx3.wait();

        let current = await scheduleCurrent.currentTime();

        let tx4 = await releaseEscrowCurrent.setLastWithdrawalTime(Number(current) - 10000);
        await tx4.wait();

        let tx5 = await scheduleCurrent.setDistributionStartTime(Number(current) - 10000);
        await tx5.wait();

        let tx6 = await stakingRewards.withdraw(parseEther("1"));
        await tx6.wait();

        let earned = await stakingRewards.earned(deployer.address);
        expect(earned).to.equal(40012);

        let rewards = await stakingRewards.rewards(deployer.address);
        expect(rewards).to.equal(40012);

        let initialBalance = await rewardToken.balanceOf(deployer.address);

        let tx7 = await stakingRewards.getReward();
        await tx7.wait();

        let newBalance = await rewardToken.balanceOf(deployer.address);
        let expectedNewBalance = BigInt(initialBalance) + BigInt(40012);
        expect(newBalance.toString()).to.equal(expectedNewBalance.toString());

        let totalSupply = await stakingRewards.totalSupply();
        expect(totalSupply).to.equal(0);

        let balanceOfDeployer = await stakingRewards.balanceOf(deployer.address);
        expect(balanceOfDeployer).to.equal(0);

        let totalAvailableRewards = await stakingRewards.totalAvailableRewards();
        expect(totalAvailableRewards).to.equal(40012);
    });
  });
});
# Tradegen Liquidity Mining

## Purpose

Implement a rewards program for bootstrapping liquidity.

## Overview

Under the liquidity mining rewards program, rewards are distributed to LP (liquidity provider) token holders proportional to the number of tokens they hold. Rewards are distributed according to a halvening release schedule consisting of 26-week cycles running indefinitely. The reward distribution of the first cycle is half of the lifetime distribution, and the distribution of each subsequent cycle is reduced by half. A halvening release schedule is used, as opposed to a linear release schedule, to ensure the program runs indefinitely while limiting inflation.

## Disclaimer

These smart contracts have not been audited or deployed yet.

## Repository Structure

```
.
├── abi  ## Generated ABIs that developers can use to interact with the system.
├── contracts  ## All source code.
│   ├── interfaces  ## Interfaces used for defining/calling contracts.
│   ├── openzeppelin-solidity  ## Helper contracts provided by OpenZeppelin.
│   ├── test  ## Mock contracts used for testing main contracts.
├── test ## Source code for testing code in //contracts.
```

## Docs

To learn more about the Tradegen project, visit the docs at https://docs.tradegen.io.

This project is launched on the Celo blockchain. To learn more about Celo, visit their home page: https://celo.org/.

Source code for the Tradegen token (TGEN): https://github.com/Tradegen/tradegen-token.

## License

MIT

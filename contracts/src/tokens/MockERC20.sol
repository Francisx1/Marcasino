// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    // 构造函数：初始化代币名称和符号
    constructor() ERC20("Marcasino Token", "MCT") {
        // 部署时给自己铸造 10,000 个代币
        _mint(msg.sender, 10000 * 10 ** decimals());
    }

    // 水龙头功能：任何人调用此函数，获得 100 个代币
    function faucet() external {
        _mint(msg.sender, 100 * 10 ** decimals());
    }

    // 只有 owner 可以随意铸造（用于测试需要更多钱时）
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
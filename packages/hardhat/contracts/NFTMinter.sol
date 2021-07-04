//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMinter is ERC721 {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    address payable owner;

    constructor(string memory tokenName, string memory symbol) public ERC721(tokenName, symbol) {
        _setBaseURI("ipfs://");
        owner = msg.sender; // Whoever deploys smart contract becomes the owner
    }

    function mintToken(address owner, string memory metadataURI)
    external payable
    returns (uint256)
    {
        _tokenIds.increment();

        uint256 id = _tokenIds.current();
        _safeMint(owner, id);
        _setTokenURI(id, metadataURI);

        return id;
    }

    //function for enabling contract to receive bnb
    fallback() external payable {}

    // Function to withdraw all Ether from this contract.
    function withdraw() public {
        // get the amount of Ether stored in this contract
        uint amount = address(this).balance;

        // send all Ether to owner
        // Owner can receive Ether since the address of owner is payable
        (bool success,) = owner.call{value: amount}("");
        require(success, "Failed to send Ether");
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

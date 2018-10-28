pragma solidity ^0.4.4;

contract Adoption {
    // array of adopter ethereum wallet addresses
    // 16 is the number of available pet
    address[16] public adopters;

    event adopted(address owner, uint petId);

    // adopt one of pet
    function adopt(uint petId) public returns (uint) {
        // validation of pet id
        require(petId >= 0 && petId <= 15, "Illegal pet id");

        // msg.sender = adopter ethereum wallet address
        adopters[petId] = msg.sender;

        emit adopted(msg.sender, petId);

        // return same pet id as success confirmation
        return petId;
    }

    function getAdopters() public returns (address[16]) {
        return adopters;
    }
}

pragma solidity 0.4.24;

contract Poster {        
    
    struct Post {
        address author;
        string content;
    }

    event postEvent (
    );

    // Read/write posts
    mapping(uint => Post) public posts;
    uint public postsCount;

    function post (string _content) public {                
        // Increase posts counter
        postsCount++;

        // Store the post's content
        posts[postsCount] = Post(msg.sender, _content);

        // Trigger post event
        emit postEvent();
    }
}
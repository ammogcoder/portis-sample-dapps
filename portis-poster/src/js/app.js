const Buffer = buffer.Buffer;
const PortisProvider = Portis.PortisProvider;

App = {
  web3Provider: null,
  contracts: {},
  account: '',
  ipfs: null,

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {      
      // Specify default instance if no web3 instance provided      
      web3 = new Web3(new PortisProvider({
        network: 'kovan'
      }));
      App.web3Provider = web3.currentProvider;
    }
    return App.initIpfs();
  },

  initIpfs: function() {
    //ipfs = IpfsApi('localhost', '5001');
    ipfs = IpfsApi('hardbin.com', '443', { protocol: 'https' });
    // ipfs = IpfsApi('ipfs.infura.io', '5001', { protocol: 'https' });
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Poster.json", function(poster) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Poster = TruffleContract(poster);
      // Connect provider to interact with contract
      App.contracts.Poster.setProvider(App.web3Provider);
      // Listen to event once transaction is deployed.
      App.listenForEvents();
      return App.render();
    });
  },

  render: function() {
    App.showLoading();    
    App.loadContractData();    
    App.showLoading(false);
  },

  // Load all the posts from the deployed contract
  loadContractData: function() {
    // Retrieve total number of posts
    App.contracts.Poster.deployed().then(function(instance) {
      posterInstance = instance;
      return posterInstance.postsCount();
    })
    // Get all the posts from the contract
    .then(function(postsCount) {
      const contractPosts = [];
      postsCount = postsCount.toString(10);
      for (var i = 0; i < postsCount; i++) {
        contractPosts[i] = posterInstance.posts(i + 1);
      }
      return Promise.all(contractPosts);
    })    
    .then(function(contractPosts) {
      const ipfsRequests = [];      
      // Get posts from newest to oldest from ipfs
      contractPosts.reverse().forEach(function(post) {
        ipfsRequests.push(ipfs.cat(post[1]));
      });
      // Render posts to page
      Promise.all(ipfsRequests).then(function (ipfsPosts) {
        // Clear existing posts
        $("#posts").empty();
        ipfsPosts.forEach(function(post, i) {
          if (post) {
            var author = contractPosts[i][0];
            var content = post.toString('utf8');
            $("#posts").append(`<tr><td>${content}<br><b>Published by: ${author}</b></td></tr>`);
          }
        });
      });
    }).catch(function(error) {
      console.warn(error);
    });
  },

  publishPost: function() {
    // Get the first (and only) connected account
    web3.eth.getAccounts(function(err, accounts) {
      if (err || !accounts || !accounts.length) {
        return console.error(err || 'Can\'t publish post since there is no connectd account.');
      }

      App.account = accounts[0];
      const content = $('#postContent').val();
      $('#postContent').val('');    
      App.showLoading();
      
      // Store the post content in ipfs.
      ipfs.add(Buffer.from(content), function (err, res) {
        if (err || !res) {
          App.showLoading(false);
          return console.error('ipfs connection error', err);
        }

        // Store the ipfs hash (the key for the post content) in the contract
        App.contracts.Poster.deployed().then(function(instance) {        
          return instance.post(res[0].hash, { from: App.account });
        }).catch(function(err) {
          console.error('Failed to publish a new post.', err);
          App.showLoading(false);
        });
      });          
    });       
  },
  
  listenForEvents: function() {
    // Register to postEvent so the clients will reload once a new post is published.
    App.contracts.Poster.deployed().then(function(instance) {
      instance.postEvent().watch(function(err, event) {
        console.log('event');
        if (err) {
          console.warn(err);
        }
        App.render();
      });
    });
  },

  showLoading(show = true) {
    if (show) {
      $("#content").hide();
      $("#loader").show();
    } else {
      $("#loader").hide();
      $("#content").show();
    }
  }
};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
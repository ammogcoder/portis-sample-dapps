App = {
    web3Provider: null,
    contracts: {},
    portisClientHosts: {
        'https://app.portis.io': 'portisConfEnvProd',
    },

    init: function () {
        // Load pets.
        $.getJSON('../pets.json', function (data) {
            var petsRow = $('#petsRow');
            var petTemplate = $('#petTemplate');

            for (i = 0; i < data.length; i++) {
                petTemplate.find('.panel-title').text(data[i].name);
                petTemplate.find('img').attr('src', data[i].picture);
                petTemplate.find('.btn-adopt').attr('data-id', data[i].id);

                petsRow.append(petTemplate.html());
            }
        });

        if (!!location.search) {
            $('.portisAdvanceConf').show();
        }

        App.getPortisConf();
        return App.initWeb3();
    },

    getPortisConf: function () {
        var portisConf = localStorage.getItem('portisConf');

        if (portisConf) {
            App.portisConf = JSON.parse(portisConf);
        } else {
            App.portisConf = {
                apiKey: '1b4cdaf7bb0b0731f5da0b375ebe0bb1',
                network: 'kovan',
                infuraApiKey: '',
                providerNodeUrl: '',
                scope: undefined,
                clientHost: 'https://app.portis.io'
            }
        }

        $('#portisConfApiKey').val(App.portisConf.apiKey);
        $('#portisConfNetwork').val(App.portisConf.network);
        $('#portisConfInfuraApiKey').val(App.portisConf.infuraApiKey);
        $('#portisConfProviderNodeUrl').val(App.portisConf.providerNodeUrl);
        $('#portisConfScope').val(JSON.stringify(App.portisConf.scope));
        $('#' + App.portisClientHosts[App.portisConf.clientHost]).prop('checked', true);
    },

    initWeb3: function () {
        if (typeof web3 !== 'undefined') {
            // First, we check if there's a web3 instance already active.
            // Ethereum browsers like Mist or Chrome with the MetaMask extension
            // will inject their own web3 instances.
            // If an injected web3 instance is present,
            // we get its provider and use it to create our web3 object.
            App.web3Provider = web3.currentProvider;
        } else {
            // If no injected web3 instance is present,
            // we set Portis as the web3 provider
            var portisProvider = new window.Portis.PortisProvider(App.portisConf);

            portisProvider.elements.then(elements => {
                elements.wrapper.remove();
                portisProvider.portisClient = App.portisConf.clientHost;
                portisProvider.elements = portisProvider.createIframe();
            });

            web3 = new Web3(portisProvider);
            App.web3Provider = web3.currentProvider;
        }

        App.initEventListeners();
        return App.initContract();
    },

    initEventListeners: function () {
        web3.currentProvider.on('purchase-initiated', result => {
            console.log('purchase-initiated event:', result);
        });

        web3.currentProvider.on('login', result => {
            console.log('login event:', result);
        });
    },

    updatePortisConf: function () {
        var apiKey = $('#portisConfApiKey').val();
        var network = $('#portisConfNetwork').val();
        var infuraApiKey = $('#portisConfInfuraApiKey').val();
        var providerNodeUrl = $('#portisConfProviderNodeUrl').val();
        var scope = $('#portisConfScope').val() ? JSON.parse($('#portisConfScope').val()) : undefined;
        var clientHost = $('input[name=portisConfEnv]:checked').val();
        var portisConf = {
            apiKey,
            network,
            infuraApiKey,
            providerNodeUrl,
            scope,
            clientHost,
        };

        localStorage.setItem('portisConf', JSON.stringify(portisConf));
        location.reload();
    },

    initContract: function () {
        $.getJSON('Adoption.json', function (data) {
            // create contract interface using json data
            App.contracts.Adoption = TruffleContract(data);

            // set contract provider
            App.contracts.Adoption.setProvider(App.web3Provider);

            // mark adopted pet
            return App.markAdopted();
        });

        // bind events to controls
        return App.bindEvents();
    },

    bindEvents: function () {
        $(document).on('click', '.btn-adopt', App.handleAdopt);
        $(document).on('click', '#updatePortisConf', () => App.updatePortisConf());
        $(document).on('click', '#openPortisButton', () => App.web3Provider.showPortis());
        $(document).on('click', '#setDefaultEmailButton', () => App.setDefaultEmail($('#defaultEmail').val(), $('#defaultEmailEditable').is(':checked')));
        $(document).on('click', '#sendTokenButton', () => App.sendToken());
        $(document).on('change', '#watchEventsOn', () => App.setWatchEvents(true));
        $(document).on('change', '#watchEventsOff', () => App.setWatchEvents(false));
    },

    setWatchEvents(watch) {
        if (watch && !App.adoptedSubscription) {
            App.contracts.Adoption.deployed().then(function (instance) {
                App.adoptedSubscription = instance.adopted().watch(function (err, event) {
                    var elm = document.createElement('pre');
                    elm.innerText = JSON.stringify(event, null, 2);
                    $('#eventsContainer').append(elm);
                    App.markAdopted();
                });
            });
        } else if (App.adoptedSubscription) {
            App.adoptedSubscription.stopWatching();
            App.adoptedSubscription = null;
        }
    },

    setDefaultEmail: function (email, editable) {
        web3.currentProvider.setDefaultEmail(email, editable);
    },

    handleAdopt: function () {
        event.preventDefault();

        var button = $(this);
        var petId = parseInt($(event.target).data('id'));

        // disable button during process
        button.text('Processing..').attr('disabled', true);

        // get all accounts of current user
        web3.eth.getAccounts(function (error, accounts) {
            if (error) {
                console.error(error);
                button.text('Adopt').removeAttr('disabled');
                return;
            }

            // get first (base) account
            var account = accounts[0];

            App.contracts.Adoption.deployed().then(function (adoptionInstance) {
                return adoptionInstance.adopt(petId, { from: account });
            })
                .then(function (result) {
                    alert('Adoption success!');
                    return App.markAdopted();
                })
                .catch(function (err) {
                    // enable button again on error
                    button.text('Adopt').removeAttr('disabled');
                    console.log(err.message);
                });
        });
    },

    markAdopted: function (adopters, account) {
        // get deployed contract instance
        App.contracts.Adoption.deployed().then(function (adoptionInstance) {
            return adoptionInstance.getAdopters.call();
        })
            .then(function (adopters) {
                // update owner info
                adopters.forEach(function (adopter, i) {
                    if (adopter !== '0x0000000000000000000000000000000000000000') {
                        $('.panel-pet').eq(i).find('.pet-owner').text(adopter);
                        $('.panel-pet').eq(i).find('button').text('Adopt').attr('disabled', false);
                    }
                });
            })
            .catch(function (err) {
                console.error(err.message);
            });
    },

    sendToken: function () {
        web3.eth.getAccounts(function (error, accounts) {
            var account = accounts[0];
            var destAddress = $('#destAddress').val();
            var transferTokensAmount = $('#transferTokensAmount').val() * Math.pow(10, $('#tokenDecimals').val());
            var transferEthAmount = $('#transferEthAmount').val() * Math.pow(10, 18);
            var contractAddress = $('#erc20ContractAddress').val();
            var abiArray = [{ "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "_from", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "type": "function" }, { "inputs": [], "payable": false, "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "_from", "type": "address" }, { "indexed": true, "name": "_to", "type": "address" }, { "indexed": false, "name": "_value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "_owner", "type": "address" }, { "indexed": true, "name": "_spender", "type": "address" }, { "indexed": false, "name": "_value", "type": "uint256" }], "name": "Approval", "type": "event" }];
            var contract = new web3.eth.Contract(abiArray, contractAddress);
            var rawTransaction = {
                "from": account,
                "to": contractAddress,
                "value": transferEthAmount.toString(16),
                "data": contract.methods.transfer(destAddress, web3.utils.toHex(transferTokensAmount)).encodeABI(),
            };

            web3.currentProvider.sendAsync(
                { id: 21924, method: 'eth_sendTransaction', params: [rawTransaction] },
                (err, res) => {
                    console.log(err, res)
                },
            );
        })
    },

};

$(function () {
    $(window).load(function () {
        App.init();
    });
});

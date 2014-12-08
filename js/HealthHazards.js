var string_table = {
    click_to_load: "Click to load data",
    fetching_data: "Fetching data...",
    open_violations: " possible violations.",
    no_violations: "No violations!",
    no_data: "The EPA does not have any data in your zip code."
}

var resources = ["water"];
var tableNames = ["SDW_CONTAM_VIOL_ZIP"];
var zipNames = ["geolocation_zip"];
var large_data = {
    "data":{
        "water": []
    },
    "violations":{
        "water": []
    }
}

var months = {
    "JAN": 1, 
    "FEB": 2, 
    "MAR": 3, 
    "APR": 4, 
    "MAY": 5, 
    "JUN": 6, 
    "JUL": 7, 
    "AUG": 8, 
    "SEP": 9, 
    "OCT": 10, 
    "NOV": 11, 
    "DEC": 12
}


var epa_api_entry_url = "http://iaspub.epa.gov/enviro/efservice/";

//Quicksort from http://en.literateprograms.org/Quicksort_%28JavaScript%29
// Slightly modified to accept a key for comparison 
Array.prototype.swap=function(a, b)
{
    var tmp=this[a];
    this[a]=this[b];
    this[b]=tmp;
}

function partition(array, begin, end, pivot, comparison)
{
    var piv=array[pivot];
    array.swap(pivot, end-1);
    var store=begin;
    var ix;
    for(ix=begin; ix<end-1; ++ix) {
        if(array[ix][comparison]<=piv[comparison]) {  // <-- comparison!
            array.swap(store, ix);
            ++store;
        }
    }
    array.swap(end-1, store);

    return store;
}

function qsort(array, begin, end, comparison)
{
    if(end-1>begin) {
        var pivot=begin+Math.floor(Math.random()*(end-begin));

        pivot=partition(array, begin, end, pivot, comparison);

        qsort(array, begin, pivot);
        qsort(array, pivot+1, end);
    }
}

// Compares the database's dates with today and returns true if their
// date comes after today 
function compareDate(today, their_date){

    their_date = their_date.split("-", 3);

    //Check if its this year or later
    if(today.year <= their_date[0]){
        //Check if its in this month or later
        if(today.month <= their_date[1]){
        //Check if its today or later
            if(today.day <= their_date[2]){
                //We have an open violation!
                return true;
            }
        }
    }
    return false;
}

//Let's start the app
var app = angular.module('HealthHazard', ['ngRoute', 'infinite-scroll']);

// Configure routes
app.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/', {
                templateUrl: 'templates/index.html',
                controller: ''
            }).
            when('/water', {
                templateUrl: 'templates/water.html',
                controller: ''
            }).
            otherwise({
                redirectTo: '/'
            })
    }]);


// This controls most of the functions of the app
app.controller("BodyController", function($scope, $http, $q, $location) {
    
    // The zip code controls everything about this app.
    // EPA data is able to be looked up by ZIP code, 
    // which is much easier to standardize than 
    // city/state given the Google geo data API.

    // Set initial value of your zip code.
    $scope.my_zip = false;
    $scope.lookup_zip = "";

    //Remembers whether a geo lookup succeeds or not
    $scope.geo_failed = false;

    //enable abort on the http call
    var canceler;

    //show or hide the info on front page
    $scope.show_info = true;

    //Set up resources:
    //$scope.resetData();
    // // Local tap water data
    $scope.water = {
        name: "water",
        loading: false,
        loaded: false,
        clean: true,
        tableName: "SDW_CONTAM_VIOL_ZIP",
        zipName: "geolocation_zip",
        title: string_table.click_to_load,
        data: [],
        dataLength: 0,
        violations: [],
        violationsLength: 0,
        viewing: ""
    }

    // Function to get user's zip code from geolocation data, then callback 
    // a populate or error handler
    function geolocationData(){

        var geolocation_success = null;
        var geo_timer;

        if (!navigator.geolocation){
            geoFailed("Browser doesn't support geolocation");
            return false;
        }

        // Reverse lookup to get user's address
        // Credit: http://stackoverflow.com/questions/6478914/reverse-geocoding-code
        
        function success(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var latlng = new google.maps.LatLng(lat, lng);
            // This is making the Geocode request
            var geocoder = new google.maps.Geocoder();
            geocoder.geocode({ 'latLng': latlng }, function (results, status) {
                if (status !== google.maps.GeocoderStatus.OK) {
                    geoFailed("geocoder.geocode failure");
                } else if (status == google.maps.GeocoderStatus.OK) {
                // This is checking to see if the Geoeode Status is OK before proceeding
                    var address = results[3].formatted_address;
                    //Process the zip code
                    var re = /^[^\d]*([\d]*)[.]*/i;
                    $scope.my_zip = address.match(re)[1];
                    $scope.$apply();
                    //populateData();
                }
            });
        }

        function error() {
            geoFailed("getCurrentPosition failure");
        }

        navigator.geolocation.getCurrentPosition(success, error, {timeout: 10000});

        return true;
    }

    //If geolocation fails, prompt the user for input
    function geoFailed(msg){
        $scope.my_zip = false;
        $scope.geo_failed = true;
        console.log(msg);
    }

    //Populate the data once a zip code is found
    function populateData(resource) {

        resource.loading = true;
        resource.title = string_table.fetching_data;
        resource.loaded = false;
        //$scope.$apply();
        fetchResource(resource);

    }
    $scope.populateData = populateData;

    //A generic method for fetching data
    function fetchResource(resource){

        canceler = $q.defer();

        //Set up the url
        var fullUrl = epa_api_entry_url;
        fullUrl += resource.tableName + "/" + resource.zipName;
        fullUrl += "/=/";
        fullUrl += $scope.my_zip;

        //Complete the request
        var request = $http({
            method: "get",
            url: fullUrl,
            data: {},
            timeout: canceler.promise
        }).
        success(function(data, status){
            //Unfortunately we have an xml object now. Thanks alot EPA.
            //Their JSON system breaks if you try to get more than 200 rows!!
            if(status === 200){
                try {
                    // Construct a new list for the resource object
                    var resource_data = []

                    // Parse the returned xml
                    var xml = $.xml2json( data );

                    //Check if there's data
                    if(xml[resource.tableName] !== undefined){
                        // Construct a "today" object    
                        var today = new Date();
                        today = today.toLocaleDateString();
                        today = today.split("/", 3);
                        today = { year: today[2].slice(-2), month: today[0], day: today[1] }

                        var their_date;

                        //Loop through each row in returned data
                        for( var i = 0; i < xml[resource.tableName].length; i++ ){
                            //first standardize the date row
                            their_date = xml[resource.tableName][i]["COMPPERENDDATE"];
                            their_date = their_date.slice(-2) + "-" + 
                                months[their_date.slice(3, 5)] + "-" + 
                                their_date.slice(0, 1);
                                xml[resource.tableName][i]["their_date"] = their_date
                            // Check if they have an open case
                            // Sometimes the case isn't open, but the enforcement wasnt "achieved"!!
                            // That means they issued a warning or penalty, but it wasnt resolved!
                            if(compareDate(today, their_date) === true || 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "St Compliance achieved" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed Compliance achieved" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "St BCA signed" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed BCA signed" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed No longer subject to Rule" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "St No longer subject to Rule" &&
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed No addtl Formal Action needed" && 
                                xml[resource.tableName][i]["ENFACTIONNAME"] != "St No addtl Formal Action needed" && 
                                xml[resource.tableName][i]["VNAME"] != "CCR Complete Failure to Report" && 
                                xml[resource.tableName][i]["VNAME"] != "Initial Tap Sampling for Pb and Cu"){
                                //They do!! Add it to data
                                resource_data.push(xml[resource.tableName][i]);
                            }

                        }
                        //Sort the original array
                        qsort(xml[resource.tableName], 0, xml[resource.tableName].length, "their_date");
                        //Sort the violations
                        qsort(resource_data, 0, resource_data.length, "their_date");

                        //Now update the resource objects values
                        if(resource_data.length > 0){
                            //Uh oh, there are violations.
                            resource.title = resource_data.length + string_table.open_violations;
                            resource.loading = false;
                            resource.loaded = true;
                        } else {
                            resource.title = string_table.no_violations;
                            //resource.title += " (" + xml[resource.tableName].length + " past violations)";
                            resource.loading = false;
                            resource.loaded = true;
                        }
                        //This data can be huge. Probably would be better to process
                        // server side. Oh well... limited time!!
                        //resource.data = xml[resource.tableName];
                        //Idea--- let's put the first 10 results in the resources 'data'
                        // Then dynamically load more.
                        large_data["data"][resource.name] = xml[resource.tableName];
                        resource.data = [];
                        for( var i = 0; i < 10; i++ ){
                            if(xml[resource.tableName][i] !== undefined){
                                resource.data.push(xml[resource.tableName][i]);
                            }
                        }

                        //You know what, do the same for violations
                        large_data["violations"][resource.name] = resource_data;
                        resource.violations = [];
                        for( var i = 0; i < 10; i++ ){
                            if(resource_data[i] !== undefined){
                                resource.violations.push(resource_data[i]);
                            }
                        }
                        resource.dataLength = xml[resource.tableName].length;
                        resource.violationsLength = resource_data.length;
                        resource.viewing = "Open Violations";
                        if(resource.violations.length > 0){
                            resource.clean = false;
                        } else {
                            resource.clean = true;
                        }
                    } else {
                        //There's no data.
                        resource.data = [];
                        resource.violations = [];
                        resource.dataLength = 0;
                        resource.violationsLength = 0;
                        resource.viewing = "";
                        resource.clean = true;
                        resource.title = string_table.no_data;
                        resource.loaded = true;
                        resource.loading = false;
                    }

                        

                }
                catch (err) {
                    resource.title = "There was an error parsing EPA's data.";
                    console.log(err);
                }
            }
                
            
        }).
        error(function(response){
            if(response !== null){
                console.log("Error fetching resource: " + response);
                resource.title = "There was an error fetching EPA's data.";
            }
        });
    }

    $scope.lookup = function (){
        $scope.my_zip = $scope.lookup_zip;
        //If there's already a request, cancel it
        if(canceler !== undefined){
            canceler.resolve();
        }
        geo_failed = false;
        $scope.resetData();
        $location.path("#/");
    }

    $scope.info = function(){
        if($scope.show_info === true){
            $scope.show_info = false;
        } else {
            $scope.show_info = true;
        }
    }

    $scope.resetData = function(){
        for(var i = 0; i < resources.length; i++){
            $scope[resources[i]] = {
                name: resources[i],
                loading: false,
                loaded: false,
                clean: true,
                tableName: tableNames[i],
                zipName: zipNames[i],
                title: string_table.click_to_load,
                data: [],
                violations: [],
                viewing: ""
            }
        }
    }

    $scope.changeView = function(resource){
        if(resource.viewing === "Open Violations"){
            resource.viewing = "Open and Closed Violations";
        } else {
            resource.viewing = "Open Violations";
        }
    }

    $scope.loadMore = function(resource, where){
        where = where || "violations";
        var last_index = resource[where].length - 1;
        for( var i = 1; i <= 4; i++ ){
            if(large_data[where][resource.name][i + last_index] !== undefined){
                resource[where].push(large_data[where][resource.name][i + last_index]);
            }
        }
    }

    //Try to initially get the geo data
    geolocationData();



});


//hack to fix the non-collapsing menu on menu item click
$(document).ready(function () {
    
    $(".clickCollapse").click(function (event) {
        //bootstrap collapses the menubar at 768 pixels by default
        if($(window).width() <= 768){
            $(".navbar-collapse").collapse('hide');
        }
    });

});
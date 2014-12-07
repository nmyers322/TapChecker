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

var loading_string = "Loading...";

var api_entry = "http://iaspub.epa.gov/enviro/efservice/";

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
var app = angular.module('HealthHazard', ['ngRoute']);

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
app.controller("BodyController", function($scope, $http, $q) {
    
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
    $scope.show_info = false;

    //Set up resources:
    // Local tap water data
    $scope.water = {
        name: "water",
        loading: true,
        clean: true,
        tableName: "SDW_CONTAM_VIOL_ZIP",
        zipName: "geolocation_zip",
        title: loading_string,
        data: [],
        violations: []
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
                    populateData();
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
    function populateData() {

        //Start by getting the local water info
        fetchResource($scope.water);
    }
    $scope.populateData = populateData;

    //A generic method for fetching data
    function fetchResource(resource){

        //Show loading
        resource.loading = true;
        resource.title = loading_string;

        canceler = $q.defer();

        //Set up the url
        var fullUrl = api_entry;
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
                        //Sometimes the case isn't open, but the enforcement wasnt "achieved"!!
                        // That means they issued a warning or penalty, but it wasnt resolved!
                        if(compareDate(today, their_date) === true || 
                            xml[resource.tableName][i]["ENFACTIONNAME"] != "St Compliance achieved" && 
                            xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed Compliance achieved" && 
                            xml[resource.tableName][i]["ENFACTIONNAME"] != "St BCA signed" && 
                            xml[resource.tableName][i]["ENFACTIONNAME"] != "Fed No longer subject to Rule"){
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
                        resource.title = resource_data.length + " open violations";
                        resource.loading = false;
                    } else {
                        resource.title = "No open violations! (" + 
                            xml[resource.tableName].length + " past violations)";
                        resource.loading = false;
                    }
                    resource.data = xml[resource.tableName];
                    resource.violations = resource_data;
                    if(resource.violations.length > 0){
                        resource.clean = false;
                    } else {
                        resource.clean = true;
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
        populateData();
    }

    $scope.info = function(){
        if($scope.show_info === true){
            $scope.show_info = false;
        } else {
            $scope.show_info = true;
        }
    }

    //Try to initially get the geo data
    geolocationData();

});

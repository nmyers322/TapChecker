TapChecker
==========

Check your zip code's water facilities for violations from the EPA. 

I ran into a few problems: The EPA database is very slow to reponse to requests which makes the user experience not so great. Also, complex queries are not possible to their API. For example, I could get all rows where the zip code matched the user's, but I couldn't get rows that were only from the last two years in the same query. Also, their date formats are very strange which makes them hard to manipulate. The water facilities don't seem to have any useful information (i.e. address or area served). The information is just generally limited and hard to interpret. 

I wrote this app for the Koding Hackathon project on December 6 and 7, 2014.

It is live at http://nate.technology/tapchecker 

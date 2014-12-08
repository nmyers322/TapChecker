TapChecker
==========

Check your zip code's water facilities for violations from the EPA. Has the ability to eventually grab more types of data from the EPA and use them as "resources". Currently there is only the water resource. Originally was supposed to be all encompassing (radiation levels, contaminants in water, air pollution, grennhouse gasses, etc). 

I ran into a few problems: The EPA database is very slow to reponse to requests which makes the user experience not so great. Also, complex queries are not possible to their API. For example, I could get all rows where the zip code matched the user's, but I couldn't get rows that were only from the last two years. Also, their date formats are very strange which makes them hard to manipulate. The water facilities don't seem to have any useful information (i.e. address or area served). The information is just generally limited and hard to interpret. 

I wrote this app for the Koding Hackathon project on December 6 and 7, 2014.

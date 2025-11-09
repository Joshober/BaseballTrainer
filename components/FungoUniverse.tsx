"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Planet3D } from './Planet3D';

// Planet data from design
const planets = [
  { 
    name: 'Mercury', 
    image: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBtZXJjdXJ5fGVufDF8fHx8MTc2MjY1MjQ4Nnww&ixlib=rb-4.1.0&q=80&w=1080',
    size: 400,
    distance: 58,
    duration: 4.5,
    color: { r: 169, g: 169, b: 169 }
  },
  { 
    name: 'Venus', 
    image: 'https://images.unsplash.com/photo-1590907043334-8eba76905b92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjB2ZW51c3xlbnwxfHx8fDE3NjI2NTI0ODd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    size: 450,
    distance: 108,
    duration: 4.5,
    color: { r: 255, g: 198, b: 73 }
  },
  { 
    name: 'Earth', 
    image: 'https://images.unsplash.com/photo-1727363584291-433dcd86a0fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBlYXJ0aCUyMHNwYWNlfGVufDF8fHx8MTc2MjY1MjQ4N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    size: 450,
    distance: 150,
    duration: 4.5,
    color: { r: 100, g: 150, b: 255 }
  },
  { 
    name: 'Mars', 
    image: 'https://images.unsplash.com/photo-1630694093867-4b947d812bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBtYXJzfGVufDF8fHx8MTc2MjY1MjQ4N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    size: 420,
    distance: 228,
    duration: 4.5,
    color: { r: 255, g: 100, b: 50 }
  },
  { 
    name: 'Jupiter', 
    image: 'https://images.unsplash.com/photo-1630839437035-dac17da580d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBqdXBpdGVyfGVufDF8fHx8MTc2MjY1MjQ4N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    size: 650,
    distance: 778,
    duration: 5,
    color: { r: 255, g: 200, b: 150 }
  },
  { 
    name: 'Saturn', 
    image: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBzYXR1cm4lMjByaW5nc3xlbnwxfHx8fDE3NjI2NTI0ODh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    size: 600,
    distance: 1434,
    duration: 5,
    color: { r: 255, g: 220, b: 150 }
  },
  { 
    name: 'Uranus', 
    image: 'https://images.unsplash.com/photo-1614732484003-ef9881555dc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjB1cmFudXN8ZW58MXx8fHwxNzYyNjUyNDg4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    size: 500,
    distance: 2871,
    duration: 4.5,
    color: { r: 100, g: 200, b: 220 }
  },
  { 
    name: 'Neptune', 
    image: 'https://images.unsplash.com/photo-1614728423169-3f65fd722b7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFuZXQlMjBuZXB0dW5lfGVufDF8fHx8MTc2MjY1MjQ4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    size: 480,
    distance: 4495,
    duration: 4.5,
    color: { r: 50, g: 100, b: 255 }
  }
];

// Raw street view locations
const rawStreetViewLocations = [
  { name: 'Times Square, New York', panoId: 'CAoSLEFGMVFpcE9fTWRsSWtOSXVUdmhEeW1OSGdCYzdMWUV1S3RudTNSZmR5TW1n', lat: 40.74844087767432, lng: -73.98566440535922 },
  { name: 'Eiffel Tower, Paris', panoId: 'CAoSLEFGMVFpcE9HVy1OQUNFa3VCZ0hQa0lKYVFJTXBsNnNjaFRaLU1ITGV3NWl3', lat: 48.858370, lng: 2.294481 },
  { name: 'Tokyo Tower, Japan', panoId: 'CAoSLEFGMVFpcE1fR0hYdDRQQW9sREExVGRPTWd2Qk43SFRJX0g3TlFkbWNDeTRV', lat: 35.658581, lng: 139.745438 },
  { name: 'Big Ben, London', panoId: 'CAoSLEFGMVFpcE5YZTRsemxQU0hYdDFIT1FCU2VGcGdwZnlNdVhfRnRjV3RBcVhL', lat: 51.500729, lng: -0.124625 },
  { name: 'Colosseum, Rome', panoId: 'CAoSLEFGMVFpcE5HdXNPODlabmZYTUNfcjk2aGRYSGxuWlJ4VGlQLUduNjFwWGFq', lat: 41.890251, lng: 12.492373 },
  { name: 'Sydney Opera House, Australia', panoId: 'CAoSLEFGMVFpcE5ETDBMbmphdHJFQndmR1hqUmV4WnV5S1VPdGNUSXE4RUlKbGJQ', lat: -33.856784, lng: 151.215297 },
  { name: 'Golden Gate Bridge, San Francisco', panoId: 'CAoSLEFGMVFpcE9ZQmpLbGZyZmlOdzdYamxzX2VUWUNScldDZUl1VVNVNi1CdHlT', lat: 37.819929, lng: -122.478255 },
  { name: 'Statue of Liberty, New York', panoId: 'CAoSLEFGMVFpcFBZbGdJc0hQcDhWRFgzVjVlMGR0WlpOa01yMm9PYWY1bXdXY3pE', lat: 40.689247, lng: -74.044502 },
  { name: 'Sagrada Familia, Barcelona', panoId: 'CAoSLEFGMVFpcFBhSlh6R0J6YzlqcXY0RGJJNzBWSXl2c01Rd3BncWdpWkFKQ3I5', lat: 41.403629, lng: 2.174356 },
  { name: 'Christ the Redeemer, Rio de Janeiro', panoId: 'CAoSLEFGMVFpcE1kcF9LWkN1SzVFc1hVZlFZdEF1TTBVSl94UjdOWGtPejBLQThG', lat: -22.951916, lng: -43.210487 },
  { name: 'Burj Khalifa, Dubai', panoId: 'CAoSLEFGMVFpcE00SjVNa0RHN2E3M1FiOFFGUWFfWTl3REItUzBJVzFPNWVBdjJ5', lat: 25.197197, lng: 55.274376 },
  { name: 'Taj Mahal, India', panoId: 'CAoSLEFGMVFpcE1oYXQ3SEd4Tm9rQlJlaWdhUGxwNzhXOXV6X1g3VTFnQWJBcFB3', lat: 27.175015, lng: 78.042155 },
  { name: 'Machu Picchu, Peru', panoId: 'CAoSLEFGMVFpcE9SU3QzaDhQd3VQUW9kRDI3aExnY0pBQ0x3QXdLT0dhS0d6STdM', lat: -13.163141, lng: -72.545128 },
  { name: 'Great Wall of China', panoId: 'CAoSLEFGMVFpcFBCRkZxS1l0cGcxVXBJTGE5cXdWZjdoRDdBTGxhRGVnSHRWMmZH', lat: 40.431908, lng: 116.570374 },
  { name: 'Santorini, Greece', panoId: 'CAoSLEFGMVFpcE9HU2xCaVZHNFdHRDFRZ0JnOXNRNlYxcUx2MVpETFh6c21TYnQ0', lat: 36.461896, lng: 25.375622 },
  { name: 'Venice Canals, Italy', panoId: 'CAoSLEFGMVFpcFBVSXB0T3RwdkVLdWtjZFhLV1hkS3FIM0RLblpQTTVWZTRxcGNN', lat: 45.434046, lng: 12.338784 },
  { name: 'Las Vegas Strip', panoId: 'CAoSLEFGMVFpcE1xLXVpaFJ5cHhNX3l5VDdka3dwM1JLU1I4R3NMNUdBOXJkcFda', lat: 36.114647, lng: -115.172813 },
  { name: 'Stonehenge, UK', panoId: 'CAoSLEFGMVFpcFBWeTl4RGQ5VlNUdW44VkJsU0F2OFFXNnZLNjhWOWpjUnNKYTJz', lat: 51.178882, lng: -1.826215 },
  { name: 'Hollywood Sign, Los Angeles', panoId: 'CAoSLEFGMVFpcE5sNWRmR3BUSTlHWXltdUFabVNMTmZ0UTZvcElBZVNOMERCdnA5', lat: 34.134117, lng: -118.321495 },
  { name: 'Niagara Falls, Canada', panoId: 'CAoSLEFGMVFpcE9QUlJSQzNseGcxQ0lWNGlNeVRBazh5RlVNa1F5SGpOWW5Kd2F1', lat: 43.078154, lng: -79.075891 },
  { name: 'Prague Castle, Czech Republic', panoId: 'CAoSLEFGMVFpcE1TaWhUUkhnTnloTnNrTHhoWEgyTWk4NXhNUjFMSnF2VVVtNGox', lat: 50.090906, lng: 14.400414 },
  { name: 'Grand Canyon, Arizona', panoId: 'CAoSLEFGMVFpcE5iTzJQQzMydGVLenBCZzR5bWdzY3FYOG9ETGRnN0lYbDNRRzU4', lat: 36.098592, lng: -112.097796 },
  { name: 'Louvre Museum, Paris', panoId: 'CAoSLEFGMVFpcE9aS0oyYmJhM3dXQ3gybzlqRHZDR0gwUktYX3hZeGpzX3FmbVJw', lat: 48.860611, lng: 2.337644 },
  { name: 'Central Park, New York', panoId: 'CAoSLEFGMVFpcE55WldPNWhMUXdmRlBJYmxBUUtDTlFMV01rT1p0bVk0a21ZTllv', lat: 40.785091, lng: -73.968285 },
  { name: 'Dubai Marina', panoId: 'CAoSLEFGMVFpcE1RWERuVnNCYVlUcjZ4WjJDNldfVjRLT09LSjhPV2x4Z0M0dHlt', lat: 25.080357, lng: 55.139360 },
  { name: 'Brooklyn Bridge, New York', panoId: 'CAoSLEFGMVFpcE1XYnpyNU5qSlNpeTRiOGlYY2lOTm1GdGJBVlA0dWpfRWV2VGhs', lat: 40.706086, lng: -73.996864 },
  { name: 'Mount Fuji, Japan', panoId: 'CAoSLEFGMVFpcE1iakRVZXZZaEY2SW53ZlNneTFnRWJZS3hUYm1tdjFJcGlDaWVB', lat: 35.360638, lng: 138.727363 },
  { name: 'Acropolis, Athens', panoId: 'CAoSLEFGMVFpcE5nSXBhbnlWRnlyaDFiY2JBLXBvSnFUbUR5OGFUNEJNOENBSnJD', lat: 37.971536, lng: 23.726442 },
  { name: 'Brandenburg Gate, Berlin', panoId: 'CAoSLEFGMVFpcE9UUzYyRUdTNUV3eEFiRGljWHJxdFRjRUZDdUZiT2R4NUpnaHdN', lat: 52.516275, lng: 13.377704 },
  { name: 'Shibuya Crossing, Tokyo', panoId: 'CAoSLEFGMVFpcE5ZN3JGNEhsN3BsR0lJUkJYMlRmM3FKd0lQbXBPWnhNcGVOYWF4', lat: 35.659517, lng: 139.700565 },
  { name: 'Angkor Wat, Cambodia', panoId: 'CAoSLEFGMVFpcE5hbmdrb3JXYXQsU2llbVJlcGFwLEtob21lcnBlYW4sQ2FtYm9kaWE', lat: 13.412469, lng: 103.867001 },
  { name: 'Petra, Jordan', panoId: 'CAoSLEFGMVFpcE5wZXRyYSxXYWRpTXVzYSxKb3JkYW4', lat: 30.328611, lng: 35.444167 },
  { name: 'Pyramids of Giza, Egypt', panoId: 'CAoSLEFGMVFpcE5weXJhbWlkcyBvZiBnaXphLEVneXB0', lat: 29.979167, lng: 31.134167 },
  { name: 'Mount Rushmore, South Dakota', panoId: 'CAoSLEFGMVFpcE5tb3VudCBydXNobW9yZSxTb3V0aCBEYWtvdGE', lat: 43.879102, lng: -103.459068 },
  { name: 'Yellowstone National Park, Wyoming', panoId: 'CAoSLEFGMVFpcE55ZWxsb3dzdG9uZSBOYXRpb25hbCBQYXJrLFd5b21pbmc', lat: 44.4280, lng: -110.5885 },
  { name: 'Yosemite Valley, California', panoId: 'CAoSLEFGMVFpcE55b3NlbWl0ZSBWYWxsZXksQ2FsaWZvcm5pYQ', lat: 37.865101, lng: -119.538330 },
  { name: 'Niagara Falls, New York', panoId: 'CAoSLEFGMVFpcE5uaWFnYXJhIGZhbGxzLE5ldyBZb3Jr', lat: 43.096214, lng: -79.037738 },
  { name: 'CN Tower, Toronto', panoId: 'CAoSLEFGMVFpcE5DTiBUb3dlcixUb3JvbnRvLE9udGFyaW8', lat: 43.642567, lng: -79.387054 },
  { name: 'Chichen Itza, Mexico', panoId: 'CAoSLEFGMVFpcE5jaGljaGVuIGl0emEsWW9jYXRhbixNZXhpY28', lat: 20.684285, lng: -88.567782 },
  { name: 'Iguazu Falls, Argentina', panoId: 'CAoSLEFGMVFpcE5pZ3VhenUgZmFsbHMsQXJnZW50aW5h', lat: -25.695278, lng: -54.436667 },
  { name: 'Christchurch, New Zealand', panoId: 'CAoSLEFGMVFpcE5jaHJpc3RjaHVyY2gsTmV3IFplYWxhbmQ', lat: -43.532054, lng: 172.636225 },
  { name: 'Uluru, Australia', panoId: 'CAoSLEFGMVFpcE51bHVydSxBdXN0cmFsaWE', lat: -25.344428, lng: 131.036882 },
  { name: 'Bondi Beach, Sydney', panoId: 'CAoSLEFGMVFpcE5ib25kaSBiZWFjaCxTeWRuZXksQXVzdHJhbGlh', lat: -33.891475, lng: 151.276684 },
  { name: 'Forbidden City, Beijing', panoId: 'CAoSLEFGMVFpcE5mb3JiaWRkZW4gY2l0eSxCZWlqaW5nLENoaW5h', lat: 39.916668, lng: 116.397026 },
  { name: 'Temple of Heaven, Beijing', panoId: 'CAoSLEFGMVFpcE50ZW1wbGUgb2YgaGVhdmVuLEJlaWppbmcsQ2hpbmE', lat: 39.882343, lng: 116.406622 },
  { name: 'Mount Everest Base Camp, Nepal', panoId: 'CAoSLEFGMVFpcE5tb3VudCBldmVyZXN0IGJhc2UgY2FtcCxOZXBhbA', lat: 28.002558, lng: 86.852778 },
  { name: 'Red Square, Moscow', panoId: 'CAoSLEFGMVFpcE5yZWQgc3F1YXJlLE1vc2NvdyxSdXNzaWE', lat: 55.753930, lng: 37.620792 },
  { name: 'St. Basils Cathedral, Moscow', panoId: 'CAoSLEFGMVFpcE5zdCBiYXNpbHMgY2F0aGVkcmFsLE1vc2NvdyxSdXNzaWE', lat: 55.752535, lng: 37.623082 },
  { name: 'Blue Mosque, Istanbul', panoId: 'CAoSLEFGMVFpcE5ibHVlIG1vc3F1ZSwgSXN0YW5idWwsIFR1cmtleQ', lat: 41.005370, lng: 28.976385 },
  { name: 'Hagia Sophia, Istanbul', panoId: 'CAoSLEFGMVFpcE5oYWdpYSBzb3BoaWEsIElzdGFuYnVsLCBUdXJrZXk', lat: 41.008583, lng: 28.980175 },
  { name: 'Parthenon, Athens', panoId: 'CAoSLEFGMVFpcE5wYXJ0aGVub24sIEF0aGVucywgR3JlZWNl', lat: 37.971515, lng: 23.726788 },
  { name: 'Alhambra, Granada', panoId: 'CAoSLEFGMVFpcE5hbGhhbWJyYSwgR3JhbmFkYSwgU3BhaW4', lat: 37.176067, lng: -3.588315 },
  { name: 'Sagrada Familia, Barcelona', panoId: 'CAoSLEFGMVFpcFBhSlh6R0J6YzlqcXY0RGJJNzBWSXl2c01Rd3BncWdpWkFKQ3I5', lat: 41.403629, lng: 2.174356 },
  { name: 'Neuschwanstein Castle, Germany', panoId: 'CAoSLEFGMVFpcE5uZXVzY2h3YW5zdGVpbiBjYXN0bGUsIEdlcm1hbnk', lat: 47.557574, lng: 10.749800 },
  { name: 'Matterhorn, Switzerland', panoId: 'CAoSLEFGMVFpcE5tYXR0ZXJob3JuLCBTd2l0emVybGFuZA', lat: 45.976300, lng: 7.658600 },
  { name: 'Leaning Tower of Pisa, Italy', panoId: 'CAoSLEFGMVFpcE5sZWFuaW5nIHRvd2VyIG9mIHBpc2EsIEl0YWx5', lat: 43.723005, lng: 10.396604 },
  { name: 'Amalfi Coast, Italy', panoId: 'CAoSLEFGMVFpcE5hbWFsZmkgY29hc3QsIEl0YWx5', lat: 40.634003, lng: 14.602680 },
  { name: 'Dubrovnik Old Town, Croatia', panoId: 'CAoSLEFGMVFpcE5kdWJyb3ZuaWssIENyb2F0aWE', lat: 42.650661, lng: 18.094424 },
  { name: 'Plitvice Lakes, Croatia', panoId: 'CAoSLEFGMVFpcE5wbGl0dmljZSBsYWtlcywgQ3JvYXRpYQ', lat: 44.865600, lng: 15.582000 },
  { name: 'Table Mountain, Cape Town', panoId: 'CAoSLEFGMVFpcE50YWJsZSBtb3VudGFpbiwgQ2FwZSBUb3duLCBTb3V0aCBBZnJpY2E', lat: -33.962822, lng: 18.401643 },
  { name: 'Victoria Falls, Zambia', panoId: 'CAoSLEFGMVFpcE52aWN0b3JpYSBmYWxscywgWmFtYmlh', lat: -17.924299, lng: 25.857223 },
  { name: 'Serengeti National Park, Tanzania', panoId: 'CAoSLEFGMVFpcE5zZXJlbmdldGksIFRhbnphbmlh', lat: -2.333333, lng: 34.833333 },
  { name: 'Marrakech Medina, Morocco', panoId: 'CAoSLEFGMVFpcE5tYXJyYWtlY2gsIE1vcm9jY28', lat: 31.629472, lng: -7.981084 },
  { name: 'Ayers Rock, Australia', panoId: 'CAoSLEFGMVFpcE5heWVycyByb2NrLCBBdXN0cmFsaWE', lat: -25.344428, lng: 131.036882 },
  { name: 'Milford Sound, New Zealand', panoId: 'CAoSLEFGMVFpcE5taWxmb3JkIHNvdW5kLCBOZXcgWmVhbGFuZA', lat: -44.641389, lng: 167.894722 },
  { name: 'Bora Bora, French Polynesia', panoId: 'CAoSLEFGMVFpcE5ib3JhIGJvcmEsIEZyZW5jaCBQb2x5bmVzaWE', lat: -16.500413, lng: -151.741490 },
  { name: 'Hawaii Volcanoes National Park', panoId: 'CAoSLEFGMVFpcE5oYXdhaWkgdm9sY2Fub2VzLCBVU0E', lat: 19.419067, lng: -155.288330 },
  { name: 'Banff National Park, Canada', panoId: 'CAoSLEFGMVFpcE5iYW5mZiBuYXRpb25hbCBwYXJrLCBDYW5hZGE', lat: 51.178363, lng: -115.570770 },
  { name: 'Lake Louise, Canada', panoId: 'CAoSLEFGMVFpcE5sYWtlIGxvdWlzZSwgQ2FuYWRh', lat: 51.425371, lng: -116.177255 },
  { name: 'Monument Valley, USA', panoId: 'CAoSLEFGMVFpcE5tb251bWVudCB2YWxsZXksIFVTQQ', lat: 36.998979, lng: -110.112169 },
  { name: 'Antelope Canyon, Arizona', panoId: 'CAoSLEFGMVFpcE5hbnRlbG9wZSBjYW55b24sIEFyaXpvbmEsIFVTQQ', lat: 36.861944, lng: -111.374167 },
  { name: 'Zion National Park, Utah', panoId: 'CAoSLEFGMVFpcE56aW9uIG5hdGlvbmFsIHBhcmssIFV0YWgsIFVTQQ', lat: 37.298202, lng: -113.026300 },
  { name: 'Arches National Park, Utah', panoId: 'CAoSLEFGMVFpcE5hcmNoZXMgbmF0aW9uYWwgcGFyaywgVXRh', lat: 38.722618, lng: -109.586365 },
  { name: 'Bryce Canyon, Utah', panoId: 'CAoSLEFGMVFpcE5icnljZSBjYW55b24sIFV0YWgsIFVTQQ', lat: 37.593038, lng: -112.187089 }
];

// Filter locations with valid panoId
const streetViewLocations = rawStreetViewLocations.filter(loc => loc.panoId);

// Starting point (first location)
const startPoint = { lat: streetViewLocations[0]?.lat || 40.74844087767432, lng: streetViewLocations[0]?.lng || -73.98566440535922 };

// Haversine distance formula
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Sort locations by distance from start point
const sortedLocations = [...streetViewLocations].sort((a, b) => {
  const distA = haversineDistance(startPoint.lat, startPoint.lng, a.lat, a.lng);
  const distB = haversineDistance(startPoint.lat, startPoint.lng, b.lat, b.lng);
  return distA - distB;
});

// Calculate cumulative distances for each sorted location
const cumulativeLocationDistances: number[] = [];
sortedLocations.forEach((loc, index) => {
  if (index === 0) {
    cumulativeLocationDistances.push(0);
  } else {
    const prevLoc = sortedLocations[index - 1];
    const segmentDist = haversineDistance(prevLoc.lat, prevLoc.lng, loc.lat, loc.lng);
    cumulativeLocationDistances.push(cumulativeLocationDistances[index - 1] + segmentDist);
  }
});

// Max swing distance (used for scaling)
const maxSwingDistance = 50000;
const maxGeoDistance = cumulativeLocationDistances[cumulativeLocationDistances.length - 1] || 1;

type Swing = {
  bat_speed_mph: number;
  attack_angle_deg: number;
  omega_peak_dps: number;
  t_start?: number;
  t_end?: number;
  t_peak?: number;
};

export default function FungoUniverse() {
  const [stage, setStage] = useState<'intro' | 'planets' | 'earth-loop' | 'descent' | 'maps'>('intro');
  const [currentPlanetIndex, setCurrentPlanetIndex] = useState(-1);
  const [selectedLocation, setSelectedLocation] = useState<typeof sortedLocations[0] | null>(null);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [cumulativeDistance, setCumulativeDistance] = useState(0);
  const [lastSwing, setLastSwing] = useState<Swing | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  // Get location from cumulative distance
  const getLocationFromDistance = (totalSwingDistance: number): typeof sortedLocations[0] => {
    // Scale swing distance to geographic distance
    const scaledDistance = (totalSwingDistance / maxSwingDistance) * maxGeoDistance;
    
    // Find the location index based on cumulative geographic distance
    let locationIndex = 0;
    for (let i = 0; i < cumulativeLocationDistances.length; i++) {
      if (scaledDistance >= cumulativeLocationDistances[i]) {
        locationIndex = i;
      } else {
        break;
      }
    }
    
    // Ensure we don't go beyond the array
    locationIndex = Math.min(locationIndex, sortedLocations.length - 1);
    
    return sortedLocations[locationIndex];
  };

  const handleSwing = (s: Swing) => {
    console.log("[FungoUniverse] 🎯 handleSwing called with:", s);
    
    // Calculate swing distance using the formula
    const swingDistance = s.bat_speed_mph * 7 + s.attack_angle_deg * 13 + s.omega_peak_dps * 17;
    
    // Update cumulative distance using functional update
    setCumulativeDistance(prevCumulative => {
      const newCumulativeDistance = prevCumulative + swingDistance;
      
      // Get location based on new cumulative distance
      const location = getLocationFromDistance(newCumulativeDistance);
      
      console.log("[FungoUniverse] 📍 Swing distance:", swingDistance, "Total distance:", newCumulativeDistance, "Location:", location.name);
      
      // Defer other state updates to ensure cumulativeDistance is updated first
      setTimeout(() => {
        // Set lastSwing with new object reference to trigger useEffect
        setLastSwing({ ...s, timestamp: Date.now() } as any);
        setSelectedLocation(location);
        
        // Always restart animation sequence
        setStage('intro');
        setCurrentPlanetIndex(-1);
        setSpeed(0);
        setDistance(0);
      }, 0);
      
      return newCumulativeDistance;
    });
  };

  // Listen to SSE swings with reconnection
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;
    let connectionEstablished = false;
    
    const connect = () => {
      if (!isMounted) return;
      
      console.log("[FungoUniverse] Connecting to SSE stream...");
      es = new EventSource("/api/swings/stream");
      
      es.onopen = () => {
        connectionEstablished = true;
        setSseConnected(true);
        console.log("[FungoUniverse] ✅ SSE connection opened and ready");
      };
      
      es.onmessage = (e) => {
        console.log("[FungoUniverse] 📨 Received SSE message:", e.data);
        try {
          // Skip ping messages (empty data or just ":")
          if (!e.data || e.data.trim() === '' || e.data.trim() === ':') {
            return;
          }
          const s: Swing = JSON.parse(e.data);
          console.log("[FungoUniverse] 🎯 Parsed swing data:", s);
          handleSwing(s);
        } catch (error) {
          console.error("[FungoUniverse] ❌ Error parsing swing data:", error);
        }
      };
      
      es.onerror = (error) => {
        console.error("[FungoUniverse] ❌ SSE error:", error);
        if (connectionEstablished) {
          setSseConnected(false);
          connectionEstablished = false;
        }
        
        // Reconnect after 2 seconds if still mounted
        if (isMounted && es) {
          es.close();
          es = null;
          reconnectTimeout = setTimeout(() => {
            if (isMounted) {
              console.log("[FungoUniverse] 🔄 Reconnecting to SSE stream...");
              connect();
            }
          }, 2000);
        }
      };
    };
    
    connect();
    
    return () => {
      isMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (es) {
        console.log("[FungoUniverse] 🔌 Closing SSE connection (component unmounting)");
        es.close();
      }
    };
  }, []);

  // Intro -> Planets transition
  useEffect(() => {
    if (stage === 'intro' && lastSwing && selectedLocation) {
      const introTimer = setTimeout(() => {
        setStage('planets');
        setCurrentPlanetIndex(0);
      }, 1000); // Faster animation
      return () => clearTimeout(introTimer);
    }
  }, [stage, lastSwing, selectedLocation]);

  // Planets animation
  useEffect(() => {
    if (stage === 'planets' && currentPlanetIndex >= 0) {
      const planet = planets[currentPlanetIndex];
      
      const speedInterval = setInterval(() => {
        setSpeed(prev => Math.min(prev + 2000, 50000));
        setDistance(prev => prev + 2000);
      }, 50);

      const timer = setTimeout(() => {
        if (currentPlanetIndex < planets.length - 1) {
          setCurrentPlanetIndex(currentPlanetIndex + 1);
          setSpeed(0);
        } else {
          setStage('earth-loop');
        }
      }, planet.duration * 300); // 70% faster

      return () => {
        clearTimeout(timer);
        clearInterval(speedInterval);
      };
    }
  }, [currentPlanetIndex, stage]);

  // Earth loop
  useEffect(() => {
    if (stage === 'earth-loop') {
      const timer = setTimeout(() => {
        setStage('descent');
      }, 1500); // Faster
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Descent
  useEffect(() => {
    if (stage === 'descent') {
      const timer = setTimeout(() => {
        setStage('maps');
      }, 1200); // Faster
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Debug: log current state
  useEffect(() => {
    console.log("[FungoUniverse] 🔍 State check - selectedLocation:", selectedLocation, "lastSwing:", lastSwing, "stage:", stage);
  }, [selectedLocation, lastSwing, stage]);

  if (!selectedLocation || !lastSwing) {
    return (
      <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-6">🚀</div>
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-5xl mb-4 font-mono">WAITING FOR SWING</h1>
            {!sseConnected && (
              <div className="text-yellow-400 text-sm">⚠️ SSE connection not established</div>
            )}
            <button
              onClick={async () => {
                const testSwing: Swing = {
                  bat_speed_mph: 75 + Math.random() * 25,
                  attack_angle_deg: -5 + Math.random() * 10,
                  omega_peak_dps: 250 + Math.random() * 100,
                  timestamp: new Date().toISOString()
                };
                console.log("[FungoUniverse] 🧪 Test swing:", testSwing);
                handleSwing(testSwing);
                
                // Also send to API
                try {
                  await fetch("/api/swings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(testSwing)
                  });
                } catch (error) {
                  console.error("[FungoUniverse] ❌ Error sending test swing:", error);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
            >
              🧪 Test Swing
            </button>
          </div>
          <div className="text-xl opacity-70 font-mono text-cyan-400">
            {sseConnected ? "Bat connected and ready" : "Connect your bat to begin"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black" style={{ perspective: '1000px' }}>
      {/* Pure black background */}
      <div className="absolute inset-0 bg-black" />

      {/* 3D Star field with depth */}
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {[...Array(300)].map((_, i) => {
          const depth = Math.random();
          const size = depth * 3 + 0.3;
          const startX = (Math.random() - 0.5) * 400;
          const startY = (Math.random() - 0.5) * 400;
          const startZ = Math.random() * -3000 - 500;
          const speed = (1 - depth) * 2 + 0.3;
          
          return (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: '50%',
                top: '50%',
                width: size,
                height: size,
                opacity: depth * 0.8 + 0.2,
                boxShadow: `0 0 ${size * 2}px rgba(255, 255, 255, ${depth * 0.8})`,
                transform: `translate3d(${startX}px, ${startY}px, ${startZ}px)`
              }}
              animate={stage !== 'maps' && stage !== 'intro' ? {
                z: [startZ, 1000],
                x: [startX, startX * 3],
                y: [startY, startY * 3],
                opacity: [0, depth * 0.8 + 0.2, 0],
                scale: [0.3, depth * 3 + 1]
              } : {}}
              transition={{
                duration: speed,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          );
        })}
      </div>

      {/* Dust particles for depth */}
      <div className="absolute inset-0 opacity-30">
        {[...Array(50)].map((_, i) => {
          const x = (Math.random() - 0.5) * 200;
          const y = (Math.random() - 0.5) * 200;
          const z = Math.random() * -2000;
          
          return (
            <motion.div
              key={i}
              className="absolute w-px h-px bg-gray-500 rounded-full"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                filter: 'blur(1px)'
              }}
              animate={stage !== 'maps' && stage !== 'intro' ? {
                z: [z, 500],
                x: [x, x * 2],
                y: [y, y * 2],
                opacity: [0.3, 0]
              } : {}}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear'
              }}
            />
          );
        })}
      </div>

      {/* Cockpit HUD */}
      <AnimatePresence>
        {(stage === 'planets' || stage === 'earth-loop') && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Corner brackets */}
            <div className="absolute top-4 left-4 w-20 h-20 border-l-2 border-t-2 border-cyan-400/60" />
            <div className="absolute top-4 right-4 w-20 h-20 border-r-2 border-t-2 border-cyan-400/60" />
            <div className="absolute bottom-4 left-4 w-20 h-20 border-l-2 border-b-2 border-cyan-400/60" />
            <div className="absolute bottom-4 right-4 w-20 h-20 border-r-2 border-b-2 border-cyan-400/60" />

            {/* HUD info */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-8 text-cyan-400 text-sm font-mono">
              <div className="bg-black/80 px-4 py-2 rounded border border-cyan-400/40">
                <div className="text-cyan-300/70 text-xs">VELOCITY</div>
                <div className="text-lg">{speed.toLocaleString()} km/s</div>
              </div>
              <div className="bg-black/80 px-4 py-2 rounded border border-cyan-400/40">
                <div className="text-cyan-300/70 text-xs">DISTANCE</div>
                <div className="text-lg">{distance.toLocaleString()} km</div>
              </div>
              <div className="bg-black/80 px-4 py-2 rounded border border-cyan-400/40">
                <div className="text-cyan-300/70 text-xs">TOTAL TRAVELED</div>
                <div className="text-lg">{cumulativeDistance.toLocaleString()}</div>
              </div>
              <div className="bg-black/80 px-4 py-2 rounded border border-cyan-400/40">
                <div className="text-cyan-300/70 text-xs">DESTINATION</div>
                <div className="text-lg">{selectedLocation.name}</div>
              </div>
            </div>

            {/* Target reticle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 border-2 border-cyan-400/30 rounded-full" />
                <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-400/30" />
                <div className="absolute top-0 left-1/2 w-px h-full bg-cyan-400/30" />
                <motion.div
                  className="absolute inset-2 border border-cyan-400/50 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Navigation display */}
            {currentPlanetIndex >= 0 && stage === 'planets' && (
              <motion.div
                className="absolute bottom-8 left-8 bg-black/90 px-6 py-4 rounded border border-cyan-400/40 font-mono text-cyan-400"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <div className="text-cyan-300/70 text-xs mb-1">APPROACHING</div>
                <div className="text-2xl">{planets[currentPlanetIndex].name}</div>
                <div className="text-xs text-cyan-300/70 mt-1">
                  {planets[currentPlanetIndex].distance} million km from Sun
                </div>
              </motion.div>
            )}

            {/* Scanlines */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-5"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 2px, rgba(0, 255, 255, 0.1) 4px)'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Intro */}
      <AnimatePresence>
        {stage === 'intro' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
              transition={{ duration: 0.75 }}
          >
            <div className="text-white text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.5 }}
              >
                <div className="text-6xl mb-6">🚀</div>
                <h1 className="text-5xl mb-4 font-mono">INITIALIZING FLIGHT SYSTEM</h1>
                <motion.div
                  className="text-xl opacity-70 font-mono text-cyan-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  DESTINATION: {selectedLocation.name}
                </motion.div>
                {cumulativeDistance > 0 && (
                  <motion.div
                    className="text-lg opacity-60 font-mono text-cyan-300 mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ delay: 0.5 }}
                  >
                    Total Distance: {cumulativeDistance.toLocaleString()}
                  </motion.div>
                )}
                <div className="mt-8 flex justify-center gap-2">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-3 h-3 bg-cyan-400 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Planets - hyper realistic 3D approach */}
      <AnimatePresence mode="wait">
        {stage === 'planets' && currentPlanetIndex >= 0 && (
          <motion.div
            key={currentPlanetIndex}
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <motion.div
              className="relative"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ z: -3000, scale: 0.1 }}
              animate={{ 
                z: [-3000, -100, 500],
                scale: [0.1, 1, 2.5],
                rotateY: [0, 15, 30],
                x: [0, 0, (Math.random() - 0.5) * 1000],
                y: [0, 0, (Math.random() - 0.5) * 1000]
              }}
              exit={{ 
                z: 1000,
                scale: 3.5, 
                opacity: 0,
                filter: 'blur(30px)'
              }}
              transition={{ 
                duration: planets[currentPlanetIndex].duration * 0.3, // Faster
                ease: [0.25, 0.46, 0.45, 0.94],
                times: [0, 0.5, 1]
              }}
            >
              <Planet3D
                image={planets[currentPlanetIndex].image}
                name={planets[currentPlanetIndex].name}
                size={planets[currentPlanetIndex].size}
                color={planets[currentPlanetIndex].color}
                rotationSpeed={15 + currentPlanetIndex * 2}
              />
            </motion.div>

            {/* Speed lines in 3D */}
            {[...Array(16)].map((_, i) => {
              const angle = (i * 22.5) * (Math.PI / 180);
              const distance = 200;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3,
                    height: Math.random() * 150 + 100,
                    background: `linear-gradient(to bottom, 
                      rgba(${planets[currentPlanetIndex].color.r}, ${planets[currentPlanetIndex].color.g}, ${planets[currentPlanetIndex].color.b}, 0.6), 
                      transparent)`,
                    left: '50%',
                    top: '50%',
                    transformOrigin: '50% 0',
                    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotateZ(${i * 22.5}deg)`
                  }}
                  animate={{
                    scaleY: [0.5, 1.5, 0.5],
                    opacity: [0.3, 0.8, 0.3]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                    ease: 'easeOut'
                  }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Earth approach and orbit */}
      <AnimatePresence>
        {stage === 'earth-loop' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <motion.div
              className="relative"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ z: -2000, scale: 0.2 }}
              animate={{ 
                z: [-2000, 0],
                scale: [0.2, 1.6],
                rotateY: [0, 360]
              }}
              transition={{ 
                z: { duration: 0.75, ease: 'easeOut' },
                scale: { duration: 0.75, ease: 'easeOut' },
                rotateY: { duration: 2.4, ease: 'linear', repeat: Infinity }
              }}
            >
              <Planet3D
                image={planets[2].image}
                name="Earth"
                size={550}
                color={planets[2].color}
                rotationSpeed={25}
              />
            </motion.div>

            {/* Orbital paths */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-cyan-400/20"
                style={{
                  width: 750 + i * 180,
                  height: 750 + i * 180
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 0.25,
                  scale: 1,
                  rotateZ: -360 
                }}
                transition={{ 
                  opacity: { duration: 1.5 },
                  scale: { duration: 1.5 },
                  rotateZ: { duration: 25 + i * 8, repeat: Infinity, ease: 'linear' }
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Atmospheric descent */}
      <AnimatePresence>
        {stage === 'descent' && (
          <motion.div
            className="absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Blue atmosphere */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 50% 100%, rgba(100, 150, 255, 0.4), rgba(30, 60, 140, 0.7), rgba(0, 20, 60, 0.95), rgba(0, 0, 0, 1))'
              }}
              animate={{
                scale: [2.5, 1],
                opacity: [0, 1, 0.9]
              }}
              transition={{ duration: 1.05 }}
            />
            
            {/* Heat particles */}
            {[...Array(40)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 4 + 1,
                  height: Math.random() * 60 + 40,
                  background: 'linear-gradient(to bottom, rgba(255, 150, 50, 0.9), rgba(255, 100, 30, 0.6), transparent)',
                  left: `${Math.random() * 100}%`,
                  top: '-20px',
                  filter: 'blur(1px)'
                }}
                animate={{
                  y: [0, window.innerHeight + 100],
                  opacity: [0, 1, 0.8, 0]
                }}
                transition={{
                  duration: Math.random() * 1.2 + 0.6,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: 'linear'
                }}
              />
            ))}

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="text-cyan-400 font-mono text-2xl bg-black/70 px-8 py-4 rounded border border-cyan-400/40"
                animate={{
                  opacity: [1, 0.7, 1]
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                ENTERING ATMOSPHERE...
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Maps */}
      <AnimatePresence>
        {stage === 'maps' && (
          <motion.div
            className="absolute inset-0 z-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75 }}
          >
            <iframe
              src={`https://www.google.com/maps/embed?pb=!4v1731169200000!6m8!1m7!1s${selectedLocation.panoId}!2m2!1d${selectedLocation.lat}!2d${selectedLocation.lng}!3f0!4f0!5f0.7820865974627469`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Street View"
            />
            <motion.div
              className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-8 py-4 rounded-lg border border-cyan-400/40 font-mono"
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="text-cyan-400 text-sm mb-1">LANDING SUCCESSFUL</div>
              <div className="text-xl">📍 {selectedLocation.name}</div>
              <div className="text-cyan-300/70 text-sm mt-2">Total Distance: {cumulativeDistance.toLocaleString()}</div>
              <div className="text-cyan-300/70 text-xs mt-1">Swing again to travel further!</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

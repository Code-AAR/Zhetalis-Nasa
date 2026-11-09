// Real places Spirit visited in Gusev Crater, as stops you can walk or drive to. Pure data (no imports) so the
// terrain code can keep craters away from them. Every fact comes from NASA or press pages listed in `url`.
// Positions are in game metres from the camp (east +x, north -z). The game squeezes the real 3 km trip to the Columbia
// Hills into a few hundred metres, so every stop is much closer than in real life, and the sizes are enlarged.
const TIMELINE = 'https://en.wikipedia.org/wiki/Timeline_of_Spirit';
const NASA_FINDS = 'https://ares.jsc.nasa.gov/missions/mer/important-discoveries.html';
const SKY = 'https://skyandtelescope.org/astronomy-news/spirit-samples-husband-hill/';

// Old saves called the silica stop 'tyrone' (Tyrone was really a sulfate soil nearby); sites.js maps it to 'gertrude'.
export const SITES = [
  { id: 'heatshield', name: 'Heat shield', x: 119, z: 4, kind: 'shield', view: { a: -.9, d: 9, h: 3 }, points: 3, verb: 'look at the heat shield',
    kid: 'Spirit\'s heat shield, about 2.65 m across, fell away during landing and hit the ground near Bonneville crater. From the crater rim, Spirit saw it as a tiny shiny speck. Later a NASA orbiter photographed its damaged remains from above.',
    source: 'NASA HiRISE and APOD', url: 'https://hirise.lpl.arizona.edu/PSP_001513_1655' },
  { id: 'hillary', name: 'Hillary outcrop, Husband Hill summit', x: 199, z: 187, kind: 'ledge', view: { a: 2.2, d: 11, h: 3.5 }, points: 4, verb: 'study the Hillary outcrop',
    kid: 'Hillary is a rock outcrop at the top of Husband Hill, about 106 m above the landing site. The team named it for Sir Edmund Hillary. After a rocky climb, Spirit stood tilted almost 30 degrees next to it in October 2005. The hill in the game is much smaller than the real one.',
    source: 'NASA Photojournal', url: 'https://science.nasa.gov/photojournal/spirit-wiggles-into-position' },
  { id: 'homeplate', name: 'Home Plate', x: 256, z: 191, kind: 'plateau', view: { a: -2.4, d: 13, h: 3 }, points: 5, verb: 'study the layers of Home Plate',
    kid: 'Home Plate is a plateau about 90 m wide. At its edge, a stack of rock about 1.5 m thick has coarse grains below and fine grains above. A small rock bent the layers under it, called a bomb sag. Scientists link Home Plate to an explosive eruption.',
    source: 'NASA Johnson Space Center', url: 'https://webarchive.library.unt.edu/eot2008/20080916103427/http://www.nasa.gov/centers/johnson/home/jsc_homeplate_mars.html' },
  { id: 'gertrude', name: 'Gertrude Weise silica soil', x: 326, z: 233, kind: 'silica', points: 5, verb: 'look at the white silica soil', view: { a: -2.6, d: 10, h: 4 },
    kid: 'In 2007 Spirit\'s jammed front wheel dragged through soil next to Home Plate and dug up a bright white strip. The team named it Gertrude Weise, after a baseball player. Tests showed about 90 percent silica, a record for Mars. On Earth that forms at hot springs and steam vents.',
    source: 'NASA JPL', url: 'https://www.jpl.nasa.gov/news/mars-rover-spirit-unearths-surprise-evidence-of-wetter-past/' },
  { id: 'troy', name: 'Troy', x: 215, z: 262, kind: 'stuck', view: { a: -.3, d: 8, h: 3 }, points: 4, verb: 'see where Spirit got stuck',
    kid: 'In April 2009 Spirit broke through a thin crust at the edge of a shallow crater, about 8 m wide, and sank into soft sand. It never got out. Spirit\'s last message to Earth came on 22 March 2010.',
    source: 'NASA Photojournal', url: 'https://science.nasa.gov/photojournal/adjusted-local-topography-map-of-spirits-surroundings' },
];

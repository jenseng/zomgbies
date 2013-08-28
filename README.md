# ZOMGBIES!

A little zombie game written in ~~JavaScript~~ CoffeeScript

[Try it out](http://jenseng.github.io/zomgbies)

## TODO

* more obstacles
* what to do with edge of board (wrap? scroll?)
* moar sprites
  * have soft thresholds for switching directional sprites (so no jitters)
* better bestMoveFor ... don't give up so quick if strafing, just if
ping-ponging
* sounds
  * zombies
* animations
  * better grenade
  * gunshot
* weapons
  * sword
  * flamethrower (hold mouse/space allows aiming via mouse/keyboard)
  * grenade bonus (hold mouse/space allows further distance, maybe aim?)
* spawn weapons, bonuses
* agent health
* detect player->anything collisions (e.g. right now can walk through
buildings)
  * chance to knock over zombie if just grazed (not full on collision)
* don't retrack on every tick, have some variation (some zombies more
  reactive than other). when not retracking, continue current action/path
* redo run loop and all timing stuff, i.e.
  * decouple render and use requestAnimationFrame (but just for rendering)
  * no setTimeout except for main run loop
  * all timing/speed/etc. info in terms of ms, not in ticks ... then on
    slow machines we can have a higher nextTick if needed
* better HUD
* high scores
* ai mode (watch through binoculars)

# ZOMGBIES!

A little zombie game written in ~~JavaScript~~ CoffeeScript

[Try it out](http://jenseng.github.io/zomgbies)

## TODO

* detect player->zombie collisions
  * chance to knock over zombie if just grazed (not full on collision)
* redo run loop and all timing stuff, i.e.
  * decouple render and use requestAnimationFrame (but just for rendering)
  * no setTimeout except for main run loop
  * all timing/speed/etc. info in terms of ms, not in ticks ... then on
    slow machines we can have a higher nextTick if needed
* better HUD
* high scores
* moar sprites
* sounds
  * zombies
* animations
  * better grenade
  * gunshot
  * blood
* weapons
  * sword
  * flamethrower (hold mouse/space allows aiming via mouse/keyboard)
  * grenade bonus (hold mouse/space allows further distance, maybe aim?)
* ai mode (watch through binoculars)

# ZOMGBIES!

A little zombie game written in ~~JavaScript~~ CoffeeScript

[Try it out](http://jenseng.github.io/zomgbies)

## TODO

* moar sprites
* better bestMoveFor ... don't give up so quick if strafing, just if
ping-ponging
* collision fixes/enhancements
  * detect inter-tick collisions (so we don't pass through things, or
    have weird rebound tangents)
  * ability to land on a item on target (structure, tracker), set zRest
  * chance to knock over zombie if just grazed (not full on collision)
* animations
  * better grenade
  * gunshot
* weapons
  * sword
  * flamethrower (hold mouse/space allows aiming via mouse/keyboard)
  * grenade bonus (hold mouse/space allows further distance, maybe aim?)
* spawn weapons, bonuses
* agent health
* don't retrack on every tick, have some variation (some zombies more
  reactive than other). when not retracking, continue current action/path
* redo run loop and all timing stuff, i.e.
  * decouple render and use requestAnimationFrame (but just for rendering)
  * all timing/speed/etc. info in terms of ms, not in ticks ... then on
    slow machines we can have a higher nextTick if needed
* better HUD
* high scores
* ai mode (watch through binoculars)
* achievements
  * moonwalk
  * panda time (find panda suit + flamethrower) 
  * platform nine and three-quarters
  * speedy gonzales
  * beat him while he's down (kill a maimed zombie)
  * i'm walkin' here! (knock over 10 zombies in a row)
  * playing favorites (same zombie 5 times in a row)
  * combo / streaks / total
  * sharpshooter (distance)
  * william tell (land a grenade on a zombie's head)

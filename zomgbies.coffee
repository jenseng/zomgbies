(($) ->

  sectorSize = 36
  pixelsPerMeter = 36
  gravity = 9.8 * pixelsPerMeter

  abs = Math.abs
  cos = Math.cos
  sin = Math.sin
  atan2 = Math.atan2
  rand = Math.random
  floor = Math.floor
  ceil = Math.ceil
  round = Math.round
  sqrt = Math.sqrt
  min = Math.min
  max = Math.max
  pow = Math.pow

  PI = Math.PI
  TAU = PI * 2
  HALF_PI = PI / 2
  QUARTER_PI = PI / 4
  TEN_DEGREES = PI / 18
  SQRT_2 = sqrt(2)
  SPRITE_WIDTH = 36
  SPRITE_HEIGHT = 72
  AGENT_HEIGHT = 58

  # totally useless "accessibility"
  $status = $("<div>", style: "position: relative; z-index: -1; overflow: hidden; width: 0; height: 0;", "aria-live": "polite", "role": "log").appendTo($(document.body))

  lastRead = new Date().getTime()
  read = (text) ->
    now = new Date().getTime()
    if not lastRead or now > lastRead + 1000
      lastRead = now
      $status.text(text)

  pick = ->
    arguments[floor(rand() * arguments.length)]

  makeObservation = ->
    read pick(
      "this is terrifying"
      "you're not doing very well"
      "this is hard to watch"
      "not bad"
      "pro tip: kill the zombies"
      "nicely done"
      "watch out"
      "look out"
      "here they come"
      "lol"
      "wow"
      "haha"
      "that was amazing"
      "good job"
      "gotta be quick"
      "you've got this"
      "you're a natural"
      "does my voice sound weird to you?"
      "i've got a bad feeling about this"
      "nice shooting, tex"
    )
    setTimeout makeObservation, 5000 + 1000 * floor(rand() * 20)

  setTimeout makeObservation, 10000

  normalizeDirection = (direction) ->
    if direction > PI
      direction -= TAU
    else if direction < -PI
      direction += TAU
    direction

  hypotenuse = (a, b) ->
    sqrt(a * a + b * b)

  sum = (array) ->
    cnt = 0
    cnt += i for i in array
    cnt

  register = (name, constructor) ->
    @types ?= {}
    constructor::name = name
    @types[name] = constructor

  factory = (name, args...) ->
    new @types[name](args...)

  Zomgbie = ($canvas, options) ->
    new Game($canvas, options).run()

  Zomgbie.registerExtension = (type, name, constructor) ->
    if type is 'weapon'
      Weapon.register name, constructor
    else if type is 'structure'
      Structure.register name, constructor

  class Game
    constructor: (@$canvas, options) ->
      config = @config = $.extend({}, @config, options, true)

      @board = new Board(this, $canvas)
      @agents = new AgentList(this)
      @mouseTarget = new MouseTarget(this)
      for [name, args...] in config.structures ? {}
        @agents.push Structure.factory(name, this, args...)
      @agents.restackStructures()

      if config.mode is 'observe'
        config.patrolCorrection = 1
        config.pursueTargets = false
        @addAllZombies()
      else
        @stats = new Stats(this)
        @player = new Player(this, @mouseTarget)
        @agents.push @player
      @addListeners $canvas

      @setPursuitThreshold config.pursuitThreshold
      @tickTime = floor(1000 / config.ticksPerSecond)
      @times = run: [], render: []

    config:
      ticksPerSecond: 30
      maxZombies: 0
      maxSpawnsPerTick: 50
      pursuitThreshold: 200
      patrolCorrection: 3
      pursueTargets: true
      mode: 'play'
      weapons: ['colt'] # sword | grenades

    addListeners: ->
      $doc = $(document)

      @$canvas.on 'mousemove', (e) =>
        @mouseTarget.set e.clientX, e.clientY * 2
        @player?.mouseMove()

      @$canvas.on 'mousedown', (e) =>
        @mouseTarget.set e.clientX, e.clientY * 2
        @player?.mouseDown()

      @$canvas.on 'mouseup', (e) =>
        @mouseTarget.set e.clientX, e.clientY * 2
        @player?.mouseUp()

      $doc.on 'keydown', @keyDown
      $doc.on 'keyup', @keyUp

      if @config.resize
        $(window).on 'resize', @board.resize
      return

    keyDown: (e) =>
      key = e.which
      @player?.keyDown(key)
      return

    keyUp: (e) =>
      key = e.which
      @player?.keyUp(key)
      return

    time: (label, code) ->
      start = new Date().getTime()
      ret = code.call(this)
      times = @times[label]
      times.shift() if times.length > 100
      times.push(new Date().getTime() - start)
      ret

    run: =>
      @times.nextTick ?= @times.started = new Date().getTime()
      @times.nextTick += @tickTime

      @time 'run', ->
        @maybeAddZombies()
        @agents.move()
        @agents.sort()

      @time 'render', ->
        if @player
          @board.render @mouseTarget, @agents, @player.weapons, @stats
        else
          @board.render @agents, @mouseTarget
      if @pursuitThreshold > @config.pursuitThreshold
        @setPursuitThreshold @pursuitThreshold - 2
      setTimeout @run, @times.nextTick - new Date().getTime()
      return

    addAllZombies: ->
      for i in [0...@config.maxZombies]
        zombie = new Zombie(this, @mouseTarget)
        zombie.randomStart @board
        @agents.push zombie
      return

    maybeAddZombies: ->
      agents = @agents
      config = @config
      numZombies = agents.numZombies
      maxZombies = config.maxZombies
      if numZombies < maxZombies and rand() * 80 < 1
        toAdd = min(ceil(rand() * config.maxSpawnsPerTick), maxZombies - numZombies)
        if rand() < 0.2
          if toAdd is 1
            read if numZombies is 0 then "zombie" else pick("another zombie", "yet another", "zombie", "walker")
          else if (toAdd < 4)
            read pick("zombies", "here they come", "here come a couple", "yikes")
          else
            read pick("uh oh", "oh no", "damn", "oh crap a lot of zombies", "here comes the horde", "whoa that's a lot", "they just keep coming")
        for i in [0...toAdd]
          zombie = new Zombie(this, @player)
          zombie.randomEdgeStart @board
          @agents.push zombie
      return

    gameOver: ->
      @config.patrolCorrection = 1
      messages = @config.messages.gameOver
      message = pick.apply(this, messages)
      read "game over. " + message
      read = ->
      @stats.setStatus message
      return

    setPursuitThreshold: (newVal) ->
      @pursuitThreshold = newVal
      @pursuitThresholdSquared = newVal * newVal
      return

    noise: (factor = 1) ->
      @setPursuitThreshold min(@pursuitThreshold + factor * @config.pursuitThreshold, 3 * @config.pursuitThreshold)

  class Board
    constructor: (@game, $canvas) ->
      @config = @game.config
      @canvas = $canvas[0]
      @context = @canvas.getContext('2d')
      @resize()

    resize: =>
      @canvas.width = @canvas.offsetWidth
      @canvas.height = @canvas.offsetHeight
      @width = @canvas.width
      @height = @canvas.height * 2
      return

    renderDebug: ->
      if slopes = @game.agents.stackingSlopes
        context = @context
        context.strokeStyle = '#88f'
        for [x1, y1, x2, y2] in slopes
          context.beginPath()
          context.moveTo(x1, y1 / 2)
          context.lineTo(x2, y2 / 2)
          context.stroke()

    render: (args...) ->
      @context.clearRect 0, 0, @width, @height
      @renderDebug() if @config.debug
      for arg in args
        if arg.render
          arg.render(this)
          continue
        for arg2 in arg
          arg2.render(this)
      return

  class Stats
    constructor: (@game) ->
      @config = @game.config

    kills: 0
    killStreak: 0
    maxKillStreak: 0
    maxCombo: 0
    hitRatio: 0
    totalShots: 0
    totalHitShots: 0
    maxStatusTime: 150

    addShotInfo: (kills) ->
      @totalShots++
      if kills > 1 and kills > @maxCombo
        @maxCombo = kills
      @kills += kills
      if kills
        @totalHitShots++
        @killStreak += kills
        if @killStreak > @maxKillStreak
          @maxKillStreak = @killStreak
      else
        @killStreak = 0
      @hitRatio = @totalHitShots / @totalShots
      return

    setStatus: (@status) ->
      @statusTime = @maxStatusTime
      return

    renderText: (board, text, lineHeight, xAlign, yAlign) ->
      canvas = board.canvas
      width = canvas.width
      context = board.context
      lines = text.split("\n")

      i = 0
      while i < lines.length
        line = lines[i]
        metrics = context.measureText(line)
        if metrics.width >= width
          newLines = @wrapText(line, context, width)
          newLines.splice(0, 0, i, 1)
          i += newLines.length - 1
          lines.splice.apply lines, newLines
        else
          i++
      height = lines.length * lineHeight

      x = 10
      y = 5
      if xAlign is 'center'
        x = width / 2
      else if xAlign is 'right'
        x = width - 10
      if yAlign is 'center'
        y = (canvas.height - height) / 2
      else if (yAlign is 'bottom')
        y = canvas.height - height - 5

      context.textAlign = xAlign
      for line in lines
        context.fillText line, x, y
        context.strokeText line, x, y
        y += lineHeight
      return

    wrapText: (text, context, width) ->
      words = text.split(/\s/)
      lines = []
      line = ''
      for word in words
        testLine = line + word + ' '
        metrics = context.measureText(testLine)
        if line and metrics.width > width
          lines.push line
          line = word + ' '
        else
          line = testLine
      lines.push line
      lines

    renderDebug: (board) ->
      game = @game
      tickTime = game.tickTime
      times = game.times
      agents = game.agents
      sectors = agents.sectors
      sectorCount = 0
      sectorCount++ for sector of sectors
      @renderText board, """
          sectors: #{sectorCount}
          agents: #{agents.length}
          run: #{(sum(times.run) / tickTime).toFixed(2)}%
          render: #{(sum(times.render) / tickTime).toFixed(2)}%
        """, 30, "left", "top"
      return

    render: (board) ->
      canvas = board.canvas
      context = board.context
      player = @game.player
      weapon = player.weapon
      context.save()
      context.font = "bold 24px sans-serif"
      context.textBaseline = "top"
      context.globalAlpha = 0.6
      context.fillStyle = if player.alive then '#800' else '#333'
      context.strokeStyle = '#000'
      @renderDebug board if @config.debug
      @renderText board, """
          kills: #{@kills}
          streak: #{@killStreak} (#{@maxKillStreak})
          combo: #{@maxCombo}
        """, 30, "left", "bottom"
      @renderText board, """
          walkers: #{@game.agents.numZombies}
          < weapon: #{weapon.name} >
          ammo: #{weapon.shots or "..."}#{if weapon.cache then " / " + weapon.cache else ""}
        """, 30, "right", "bottom"
      if @statusTime
        context.font = "bold 36px sans-serif"
        context.globalAlpha = 0.6 * min(1, 4 * @statusTime / @maxStatusTime)
        @renderText board, @status, 42, "center", "center"
        @statusTime--
      context.restore()

  class Agent
    constructor: (game) ->
      @game = game
      @config = game?.config
      @agents = game?.agents
      @player = game?.player

    collisionMechanism: ->
      'rebound'

    collisionTangent: (collisionInfo) ->
      # note that we cheat a little, since the objects could overlap, so
      # this generally won't be the real tangent (unless it's a structure)
      normalizeDirection(HALF_PI + atan2(@y - collisionInfo.y, @x - collisionInfo.x))

    checkCollision: (otherX, otherY, otherSize, otherZ, otherHeight) ->
      diffY = @y - otherY
      distY = abs(diffY)
      minDist = (@size + otherSize) / 2
      minDistSquared = minDist * minDist
      return false if distY > minDist

      diffX = @x - otherX
      distX = abs(diffX)
      return false if distX > minDist

      distSquared = distX * distX + distY * distY
      return false if distSquared > minDistSquared

      return false if @z isnt otherZ and not @structure and (@z + @height < otherZ || otherZ + otherHeight < @z)

      {direction: atan2(diffY, diffX), distSquared}

    sectorRange: (x = @x, size = @size) ->
      return unless x?
      [floor((x - size / 2) / sectorSize), floor((x + size / 2) / sectorSize)]

    set: (x, y, z = @z, size = @size, height = @height) ->
      x = round(x)
      y = round(y)
      z = round(z)
      unless @x is x and @y is y and @z is z and @size is size and @height is height
        @agents.set this, x, y, z, size, height
      return

    nextMove: -> true
    render: ->
    renderShadow: ->

  class AgentList
    constructor: (@game) ->
      @sectors = {}
      @byStacking = []
      @byDistance = []

    length: 0
    numZombies: 0

    push: (item) ->
      @length++
      @byDistance.push item
      @byStacking.push item
      item

    distanceSorterFrd: (a, b) ->
      a.distSquaredFrd - b.distSquaredFrd

    distanceSorter: (a, b) ->
      a.distSquared - b.distSquared

    stackingSorter: (a, b) ->
      a.stacking - b.stacking

    sort: ->
      byDistance = @byDistance
      byStacking = @byStacking
      byDistance.sort @distanceSorterFrd
      byStacking.sort @stackingSorter
      for i in [0...@length]
        byDistance[i].distanceIdx = i
        byStacking[i].stackingIdx = i
      return

    remove: (agent) ->
      len = --@length
      byDistance = @byDistance
      byStacking = @byStacking
      byDistance.splice(agent.distanceIdx, 1)
      for i in [agent.distanceIdx...len]
        byDistance[i].distanceIdx--
      byStacking.splice(agent.stackingIdx, 1)
      for i in [agent.stackingIdx...len]
        byStacking[i].stackingIdx--
      @removeFromSectors agent, agent.sectorRange()
      return

    bestMoveFor: (agent, direction, distance) ->
      factor = if rand() > 0.5 then 1 else -1 # so we alternate between left/right
      # try lots of directions (-110:110 in steps of 10) at 2 speeds, starting w/ desired vector
      adjacentStructure = false
      player = @game.player
      for i in [1, 0.25]
        currDist = i * distance
        for j in [0...23]
          multiplier = factor * (j % 2 or -1) * round(j / 2 + 0.25)
          currDir = normalizeDirection(direction + multiplier * TEN_DEGREES)
          # 0 / 10 / -10 / 20 / -20 ...
          currMove = @validateMoveFor(agent, currDir, currDist)
          collisions = currMove.collisions
          if not collisions.length
            if j and abs(normalizeDirection(agent.direction - currDir)) > HALF_PI
              # if we're deviating a lot, pause (since we don't want to keep ping ponging)
              if agent isnt player
                agent.rest floor(rand() * 20 + 20), true
            return {
              distance: currDist * currMove.factor
              direction: currDir
              x: currMove.x
              y: currMove.y
            }
          else if j is 0 and collisions[0]?.agent?.structure
            adjacentStructure = true
          break if adjacentStructure and j >= 16 # 80 deg in either direction TODO: less if closer
        break if adjacentStructure

      # then see if we already overlap (due to spawn/bug/whatever), and if so, flee nearest neighbor at 1/2 impulse (overlap be damned)
      if collision = @closestCollision(agent)
        currDir = normalizeDirection(PI + collision.direction)
        return {
          distance
          direction: currDir
          x: agent.x + 0.5 * distance * cos(currDir)
          y: agent.y + 0.5 * distance * sin(currDir)
        }

      # we're surrounded but not overlapping, wait a tick for neighbors to leave
      return

    collisionsFor: (agent, x = agent.x, y = agent.y, size = agent.size) ->
      z = agent.z
      height = agent.height
      range = agent.sectorRange(x, size)
      sectors = @sectors
      collisions = []
      seen = {}
      for i in [range[0]..range[1]]
        sector = sectors[i]
        continue unless sector?
        for other in sector when other isnt agent and not seen[other.distanceIdx]
          seen[other.distanceIdx] = true
          if collision = other.checkCollision(x, y, size, z, height)
            collisions.push agent: other, distSquared: collision.distSquared, direction: collision.direction
      collisions

    closestCollision: (agent) ->
      collisions = @collisionsFor(agent)
      if collisions.length
        collisions.sort @distanceSorter
      collisions[0]

    validateMoveFor: (agent, direction, distance) ->
      x = agent.x
      y = agent.y
      xDiff = distance * cos(direction)
      yDiff = distance * sin(direction)
      factor = 1
      collisions = []
      for collision in @collisionsFor(agent, x + xDiff, y + yDiff)
        other = collision.agent
        if other.decayTime # can walk over bodies, but slowly
          factor = 0.6 + 0.4 * (1 - other.decayTime / other.maxDecayTime)
        else if other.sleepTime
          factor = 0.6
        else if other.object
          factor = 0.8
        else # otherwise legit collision
          collisions.push collision
      {x: x + xDiff * factor, y: y + yDiff * factor, factor, collisions}

    set: (agent, x, y, z, size, height) ->
      rangeOld = agent.sectorRange()
      agent.x = x
      agent.y = y
      agent.z = z
      agent.size = size
      agent.height = height
      agent.stacking = @stackingFor(x, y)
      if rangeOld
        @setSectors agent, rangeOld, agent.sectorRange()
      else
        @addToSectors agent, agent.sectorRange()
      return

    setSectors: (agent, rangeOld, range) ->
      [oldStart, oldEnd] = rangeOld
      [newStart, newEnd] = range
      sectors = @sectors
      return if oldStart is newStart and oldEnd is newEnd
      if oldStart < newStart
        @removeFromSectors agent, [oldStart, min(newStart - 1, oldEnd)]
      else if (oldStart > newStart)
        @addToSectors agent, [newStart, min(oldStart - 1, newEnd)]

      if (oldEnd > newEnd)
        @removeFromSectors agent, [max(oldStart, newEnd + 1), oldEnd]
      else if (oldEnd < newEnd)
        @addToSectors agent, [max(newStart, oldEnd + 1), newEnd]
      return

    addToSectors: (agent, range) ->
      sectors = @sectors
      for i in [range[0]..range[1]]
        sector = sectors[i] ?= []
        sector.push agent
      return

    removeFromSectors: (agent, range) ->
      sectors = @sectors
      for i in [range[0]..range[1]]
        sector = sectors[i]
        sector.splice sector.indexOf(agent), 1
        delete sectors[i] unless sector.length
      return

    move: ->
      numZombies = 0
      byDistance = @byDistance
      len = @length
      i = 0
      while i < len
        # closest ones get to move first
        agent = byDistance[i]
        if not agent.nextMove()
          @remove agent
          len--
        else
          numZombies++ if agent.alive and agent.zombie
          i++
      @numZombies = numZombies
      return

    render: (board) ->
      for agent in @byStacking
        agent.renderShadow board
      @game.mouseTarget.renderShadow board
      for agent in @byStacking
        agent.render board
      return

    # about stacking slopes:
    #
    # structures can be large and irregular, so we need to adjust stacking
    # of things near them. consider a structure like so:
    #
    #                /\
    #               /  \
    #              /    \
    #             /     /
    #            /     /
    #           /     /b
    #          /  x  /
    #        a/     /
    #        /     /
    #       /     /
    #       \    /
    #        \  /
    #         \/
    #
    # a is an agent with a slightly higher y than the structure (origin is
    # top left), making it technically in front, even though a human would
    # consider it behind it (the inverse is true for b). so that means "a"
    # would render on top of the structure, which is not great. so we
    # define stacking slopes to adjust agents' stacking
    #
    # first you find the point with the lowest y coordinate of any front
    # face (p1). then get the lines along the face of the shape. if either
    # end has a higher y than p1, extend a (sloped) line until you reach
    # that value. these are your stacking slopes.
    #
    #         a1
    #         ^
    #         |       /\
    #         |      /  \
    # ________|___x1/____\p1
    # \       |    /     /
    #  \      |  b/     /
    #   \     |  /     /b
    #    \    | /  x  /
    #     \   a/     /
    #      \  /     /
    #       \/     /
    #      p2\    /
    #         \  /
    #          \/
    #
    # also be sure to set the structure's stacking to the y value of p1.
    # when rendering, the structure and any points behind the stacking
    # lines will have their stacking adjusted according to the height of
    # the line at that point. for example, "a" will be drawn in its usual
    # spot, but as if it had the stacking of a1. the structure's stacking
    # will also decrease, so that agents like b will render in front.
    addStackingSlopes: (structure, newSlopes) ->
      slopes = @stackingSlopes ? []
      yMin = min(y1, y2, minY ? y1) for [x1, y1, x2, y2] in newSlopes
      for slope in newSlopes
        [x1, y1, x2, y2] = slope
        slope.push (x2 - x1) / (y2 - y1)
        slope.push min(y1, y2) - yMin
        slope.push structure
      @stackingSlopes = slopes.concat(newSlopes)
      return

    restackStructures: ->
      for structure in @byStacking when structure.structure
        structure.stacking = @stackingFor(structure.x, structure.stacking, structure)

    stackingFor: (x, y, agent) ->
      origY = y
      for [x1, y1, x2, y2, slope, yExtra, sAgent] in @stackingSlopes
        continue if agent and agent is sAgent
        continue if x < x1 or x > x2
        continue if y > y1 and y > y2
        yDiff = (x - x1) * slope
        continue if y > y1 + yDiff
        yDiff = y1 - y2 + yDiff if slope < 1
        y -= yDiff - yExtra
      y


  class Weapon
    constructor: (@game, @player) ->

    @register = register
    @factory = factory

    ready: true

    disable: (time, callback) ->
      @ready = false
      setTimeout =>
        if @player.alive
          @ready = true
        callback.call(this)
      , time
      return

    closest: ->
      for agent in @game.agents.byDistance when agent.alive and agent.zombie and not agent.sleepTime
        return agent
      return

    render: ->
    fire: ->
    fired: ->

  class Item extends Agent
    constructor: ->
      super
      @gravityPerTick = gravity / @game?.config?.ticksPerSecond

    decel: 6 # when it hits the ground after a throw
    item: true
    zRest: true

    nextMove: ->
      speed = @speed
      zRest = @zRest
      if speed > 0 or not zRest # thrown or rolling/sliding
        agents = @agents
        direction = @direction
        # TODO: if speed > size, do line/arc intersection checks (like we
        # do for bullets) so we know about inter-tick collisions. if speed
        # < size, we don't really care since any collision would just be a
        # light grazing
        # TODO2: determine if we are on top of a target, in which case
        # zRest becomes true and zSpeed is zero until we leave it (e.g.
        # roll off)
        currMove = agents.validateMoveFor(this, direction, speed)
        if collision = currMove.collisions[0]
          other = collision.agent
          # luckily we only have one moving item at a time (so far).
          # also, items are all assumed to be round with equal mass
          tan = other.collisionTangent(currMove)
          diff = normalizeDirection(tan - direction)
          if abs(diff) > QUARTER_PI
            tan = normalizeDirection(tan + PI)
            diff = normalizeDirection(diff + PI)
          if other.item
            if diff < 0
              other.direction = tan + QUARTER_PI
            else
              other.direction = tan - QUARTER_PI
            other.speed = speed * abs(sin(diff))
            direction = tan
            speed *= abs(cos(diff))
          else # agent or structure, so simple rebound off tangent
            if other.structure # not perfectly elastic though
              speed *= 0.8
            else
              other.stun 10
              speed *= 0.2
            direction = normalizeDirection(direction + diff + diff)
          @direction = direction
        @z += @zSpeed
        if @z <= 0
          if not zRest
            hit = @sounds.hit
            hit.load()
            hit.play()
            zRest = true
            @zSpeed = 0
          @z = 0
          speed -= @decel
          speed = 0 if speed < 0
          @speed = speed
        else if not zRest
          @zSpeed -= @gravityPerTick
        @zRest = zRest
        @set @x + speed * cos(direction), @y + speed * sin(direction)
      true

  class Grenade extends Item
    constructor: ->
      super
      @pulledPin = new Date().getTime()
      pin = @sounds.pin
      pin.load()
      pin.play()
      setTimeout @explode, @timeToExplode

    sounds:
      pin: $('<audio src="audio/pin.mp3" preload="auto"></audio>')[0]
      hit: $('<audio src="audio/grenadehit.m4a" preload="auto"></audio>')[0]
      explode: $('<audio src="audio/explode.mp3" preload="auto"></audio>')[0]
    timeToExplode: 1500
    trackable: true
    killRadiusSquared: 60 * 60
    maimRadiusSquared: 120 * 120
    stunRadiusSquared: 200 * 200
    distractDiameter: 1000
    speed: 64
    size: 6
    height: 6

    throwAt: (target) ->
      return if @exploded

      player = @player
      {x, y} = player
      startOffset = player.size / 2 # throwing from edge of player
      @thrown = true
      @zRest = false
      @agents.push this

      if target
        ogTarget = target
        target = target.projectedLocation(@timeToExplode + @pulledPin - new Date().getTime())
        distX = target.x - x
        distY = target.y - y
        dist = max(hypotenuse(distX, distY) - startOffset, 1)
        optimalSpeed = sqrt(dist * @gravityPerTick) * 0.85 # fudge factor due to drop and roll
        direction = atan2(distY, distX)
      else # no target, just throw it far
        optimalSpeed = @speed
        direction = normalizeDirection(rand() * TAU)
      x += startOffset * cos(direction)
      y += startOffset * sin(direction)
      @set x, y, player.height * 0.75
      @direction = direction

      # get the v/h speed (same, since 45 deg is optimal)
      optimalSpeedSide = optimalSpeed / SQRT_2
      # directional component of player's inertia (i.e. you can throw further in the direction you are going)
      inertia = player.currentSpeed * cos(player.direction - @direction)
      # from the perspective of the player
      relativeOptimalSpeed = hypotenuse(optimalSpeedSide, optimalSpeedSide - inertia)
      maxSpeed = @speed * (optimalSpeed / relativeOptimalSpeed)
      if optimalSpeed > maxSpeed
        optimalSpeedSide *= maxSpeed / optimalSpeed
      @zSpeed = optimalSpeedSide
      @speed = optimalSpeedSide

      # TODO maybe if close enough, bean zombie in head?
      # TODO throw sound
      if rand() < 0.25
        read pick("nice throw", "good arm", "good throw", "nice", "you're nolan ryan")
      return

    animationTime: 240
    animationTimeExplosion: 15

    explode: =>
      agents = @game.agents
      sounds = @sounds
      pin = sounds.pin
      hit = sounds.hit
      explode = sounds.explode

      pin.pause()
      hit.pause()
      explode.load()
      explode.play()
      if not @thrown # oh crap, didn't throw it!
        player = @player
        @thrown = true
        @set player.x, player.y, 0
        agents.push this
      @speed = 0
      @zSpeed = 0
      @exploded = true
      return

    caughtBy: (agent) ->
      if agent.distractTime
        agent.distractTime = 1
      return

    nextMove: ->
      if @exploded
        @nextMove = => --@animationTime
        hitCount = 0
        player = @player
        killRadiusSquared = @killRadiusSquared
        maimRadiusSquared = @maimRadiusSquared
        stunRadiusSquared = @stunRadiusSquared
        distractDiameter = @distractDiameter
        game = @game
        casualties = game.agents.collisionsFor(this, @x, @y, distractDiameter)
        for info in casualties
          agent = info.agent
          continue unless agent.alive
          if info.distSquared < killRadiusSquared
            hitCount++
            agent.kill()
          else if info.distSquared < maimRadiusSquared
            agent.maim floor(50 + 100 * (1 - info.distSquared / maimRadiusSquared))
          else if agent isnt @player
            if info.distSquared < stunRadiusSquared
              agent.stun floor(25 + 50 * (1 - info.distSquared / stunRadiusSquared))
            else
              agent.distract this, 60 + floor(60 * rand()), distractDiameter
        game.stats.addShotInfo hitCount
        game.noise 0.5
        if hitCount is 0
          read pick("waste", "total waste", "got nothin", "next time", "do you even aim bro?", "so close", "ooh", "d'oh", "almost", "not quite")
        else
          read pick("hahaha", "awesome, #{hitCount}", "got #{hitCount}", "haha, you blew up #{hitCount}", "ha, got #{hitCount}", "that'll teach them", "it's raining arms", "i love grenades", "strong work", "so strong", "heart grenades so much")
        @animationTime--
      else
        super
      true

    renderShadow: (board) ->
      context = board.context
      game = @game
      x = @x
      y = @y
      context.save()
      context.scale 1, 0.5
      if @exploded
        context.globalAlpha = @animationTime / Grenade::animationTime
        context.beginPath()
        context.arc x, y, 40, 0, TAU
        gradient = context.createRadialGradient(x, y, 40, x, y, 0)
        gradient.addColorStop(0, 'rgba(0,0,0,0)')
        gradient.addColorStop(0.8, 'rgba(32,24,16,0.5)')
        gradient.addColorStop(1, 'rgba(32,24,16,1)')
        context.fillStyle = gradient
        context.fill()
      else
        context.beginPath()
        context.globalAlpha = 0.2
        context.arc x, y, 3, 0, TAU
        context.fillStyle = '#000'
        context.fill()
      context.restore()

    render: (board) ->
      context = board.context
      if @exploded
        animationTime = @animationTimeExplosion - (Grenade::animationTime - @animationTime)
        return unless animationTime > 0
        context.save()
        fade = if animationTime < 12 then animationTime / 12 else 1
        fade = fade * fade * fade
        context.globalAlpha = fade
        size = if animationTime > 10 then 3 * (16 - animationTime) else 5 + animationTime / 2
        circles = size * 4
        for i in [0...circles]
          context.beginPath()
          rad = (1 + 2 * rand()) * size
          x = (5 - 10 * rand()) * size
          y = (2 - 4 * rand()) * size
          y -= (1 - animationTime / 15) * 200
          context.arc(@x + x, @y / 2 - @z + y, rad, 0, TAU)
          gray = (1 - fade) * (96 + rand() * 128)
          r = floor(gray + fade * 255)
          g = floor(gray + fade * (192 + rand() * 64))
          b = floor(gray + fade * (rand() * 128))
          opacity = 0.5 * rand() + 0.1
          context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')'
          context.fill()
        context.restore()
      else
        context.beginPath()
        context.arc @x, @y / 2 - @z - 3, 3, 0, TAU
        context.fillStyle = '#ab9'
        context.fill()
        context.strokeStyle = '#786'
        context.stroke()
      return

    timeToThrow: ->
      elapsed = new Date().getTime() - @pulledPin
      500 - elapsed

  class Grenades extends Weapon
    shots: '∞'

    fire: ->
      @grenade = new Grenade(@game)
      @firing = true
      @ready = false
      return

    fired: =>
      return unless @firing
      grenade = @grenade
      wait = grenade.timeToThrow()
      if wait > 0
        setTimeout @fired, wait
      else
        grenade.throwAt @closest()
        @firing = false
        @ready = true
      return

  class Sword extends Weapon
    shots: '∞'

  class Colt extends Weapon
    sounds:
      fire: $('<audio src="audio/colt.mp3" preload="auto"></audio>')[0]
      reload: $('<audio src="audio/reload.m4a" preload="auto"></audio>')[0]
    shots: 6
    cache: '∞'
    maxVisibleTime: 5

    fire: ->
      closest = @closest()
      direction = rand() * TAU
      player = @player
      game = @game
      agents = game.agents
      byDistance = agents.byDistance
      len = agents.length
      fire = @sounds.fire
      hitCount = 0

      game.noise()

      if closest
        direction = closest.optimalDirection
        direction += PI * (rand() / 45 - 1 / 90) # off by up to 3 degrees
        # TODO off by z as well, possibly missing or just maiming a zombie
        for agent in byDistance when agent.alive and agent isnt player
          # will the shot hit this zombie?
          hitMargin = abs(atan2(agent.size / 4, sqrt(agent.distSquaredFrd)))
          offBy = abs(agent.optimalDirection - direction)
          if offBy < hitMargin
            hitCount++
            agent.kill()

      game.stats.addShotInfo hitCount
      direction = normalizeDirection(direction + PI)
      @lastShot = {x: player.x, y: player.y, direction, visibleTime: @maxVisibleTime}
      @shots--
      if hitCount is 0
        read pick("miss", "whiff", "so close", "next time")
      else if hitCount is 1
        read pick("nice shot", "got one", "got 'em", "haha", "headshot")
      else
        read pick("oh wow", "got " + hitCount, "mega kill", hitCount + " for 1", "haha, amazing")
      fire.load()
      fire.play()
      @disable 800, =>
        @reload() unless @shots
      return

    reload: ->
      reload = @sounds.reload
      read pick("reload quick", "quick", "hurry", "c'mon", "let's go", "faster", "oh man")
      reload.load()
      reload.play()
      @disable 3000, => @shots = 6
      return

    render: (board) ->
      context = board.context
      lastShot = @lastShot
      if lastShot?.visibleTime
        {x, y, direction} = lastShot
        context.save()
        context.beginPath()
        context.moveTo(x, y / 2 - 40) # shot fired from 5/9 up player
        context.lineTo(x + 600 * cos(direction), (y + 600 * sin(direction)) / 2 - 56) # end of stroke is 7/9 up (through head of zombies)
        context.strokeStyle = '#ccc'
        context.globalAlpha = lastShot.visibleTime / @maxVisibleTime
        context.stroke()
        context.restore()
        lastShot.visibleTime--
      return


  Weapon.register 'grenades', Grenades
  Weapon.register 'sword', Sword
  Weapon.register 'colt', Colt

  class Tracker extends Agent
    constructor: (game, @target) ->
      super

    alive: true
    health: 10 # TODO
    trackable: true
    size: 24
    height: 50
    pursuitWobble: 10
    patrolWobble: 30
    maxDecayTime: 160
    deviations: 0

    collisionMechanism: (other) ->
      'avoid'

    randomStart: (board) ->
      @direction = normalizeDirection(rand() * TAU)
      @set rand() * board.width, rand() * board.height
      return

    randomEdgeStart: (board) ->
      sprite = @game.config.sprites[@sprite]
      width = board.width
      height = board.height
      startPos = rand() * 2 * (width + height)
      if startPos < width
        @direction = HALF_PI
        @set startPos, 0
      else if startPos < width + height
        @direction = PI
        @set width + sprite.width / 2, startPos - width
      else if startPos < 2 * width + height
        @direction = 3 * HALF_PI
        @set startPos - width - height, height + sprite.height * 2
      else
        @direction = 0
        @set -sprite.width / 2, startPos - 2 * width - height
      return

    render: (board) ->
      context = board.context
      sprite = @game.config.sprites[@sprite]
      decayTime = @decayTime
      maxDecayTime = @maxDecayTime
      return unless @alive or decayTime

      if decayTime or @sleepTime
        context.save()
        if (decayTime)
          context.globalAlpha = if decayTime > maxDecayTime / 2 then 1 else 2 * decayTime / maxDecayTime
        context.translate round(@x), round(@y / 2)
        context.rotate HALF_PI
        context.drawImage sprite, -sprite.width/2 - 6, -sprite.height/2
        context.restore()
      else
        context.drawImage sprite, round(@x - sprite.width / 2), round(@y / 2 - AGENT_HEIGHT)
      return

    renderShadow: (board) ->
      context = board.context
      x = @x
      y = @y
      context.save()
      context.scale 1, 0.5
      context.globalAlpha = 0.05
      context.beginPath()
      if y isnt @stacking and @config.debug
        context.arc x, y, 100, 0, TAU
        context.fillStyle = '#00f'
      else
        context.arc x, y, 10, 0, TAU
        context.fillStyle = '#000'
      context.fill()
      if time = (@sleepTime or @decayTime)
        @blood ?= @bloodStain()
        halfLife = (@totalSleepTime or @maxDecayTime) / 2
        context.globalAlpha = if time < halfLife then time / halfLife else 1
        context.drawImage @blood, x - 36, y - 36
      context.restore()

    bloodStain: ->
      canvas = document.createElement('canvas')
      context = canvas.getContext('2d')
      canvas.width = 72
      canvas.height = 72
      circles = if @alive then 5 else 10
      size = 5
      for i in [0...circles]
        context.beginPath()
        rad = (1 + rand()) * size
        x = 36 + 10 * (0.5 - rand()) * size
        y = 36 + 5 * (0.5 - rand()) * size
        context.arc x, y, rad, 0, TAU
        context.fillStyle = 'rgba(160,48,48,1)'
        context.fill()
      canvas

    nextMove: ->
      @currentSpeed = 0
      if not @alive
        @decayTime-- if @decayTime
        return @decayTime # if zero, time to remove it

      @checkProximity()

      if @sleepTime
        --@sleepTime or @revive()
      else if @manual and !@restRequired
        @manualMove()
      else if @game.config.pursueTargets and @targetVisible() and not @restRequired
        @pursue()
      else if @restTime
        @rest()
      else if rand() < 0.02
        @rest ceil(rand() * 40)
      else
        @patrol()
      true

    targetVisible: ->
      target = @target
      game = @game
      threshold = @pursuitThreshold ? game.pursuitThreshold
      distX = @distX
      distY = @distY

      return false if not target or target.alive is false
      return false if distX > threshold or distX < -threshold
      return false if distY > threshold or distY < -threshold
      @distSquared < (@pursuitThresholdSquared ? game.pursuitThresholdSquared)

    distract: (fakeTarget, distractTime, distractRadius) ->
      @targetTrackTime = @distractTime = distractTime
      @pursuitThreshold = distractRadius
      @pursuitThresholdSquared = distractRadius * distractRadius
      @targetFrd ?= @target
      @target = fakeTarget
      return

    checkProximity: ->
      target = @target
      if target?.trackable
        x = @x
        y = @y
        if @distractTime
          targetFrd = @targetFrd
          if --@distractTime
            distX = targetFrd.x - x
            distY = targetFrd.y - y
            @distSquaredFrd = (distX * distX + distY * distY)
          else
            # back on track
            @target = target = targetFrd
            @targetFrd = null
            @pursuitThreshold = null
            @pursuitThresholdSquared = null
        distX = @distX = target.x - x
        distY = @distY = target.y - y
        optimalDirection = @optimalDirection = atan2(distY, distX)
        @distSquared = (distX * distX + distY * distY)
        @distSquaredFrd = @distSquared if not @distractTime
        if @predictFactor and target.currentSpeed
          # target fleeing?
          if abs(normalizeDirection(@optimalDirection - target.direction)) < HALF_PI
            projected = target.projectedLocation(500)
            correction = @predictFactor * normalizeDirection(atan2(projected.y - y, projected.x - x) - optimalDirection)
          else # try to intercept (not perfect, since speeds don't match, but zombies aren't *that* smart)
            correction = @predictFactor * normalizeDirection(PI - (target.direction - optimalDirection))
          @optimalDirection = normalizeDirection(optimalDirection + correction)
      else
        @targetTrackTime = 0
      return

    wobble: (degrees) ->
      return 0 unless degrees
      PI * (rand() * degrees / 90 - degrees / 180)

    manualMove: ->
      direction = normalizeDirection(atan2(@manualY, @manualX))
      if @manualX or @manualY
        @move direction, @speed
      return

    pursue: ->
      # TODO: not quite right
      if @targetTrackTime
        @targetTrackTime--
      else
        @targetTrackTime = 120
      target = @target
      distSquared = @distSquared
      speed = @speed
      speedSquared = @speedSquared
      minCaptureDist = speed + (@size + target.size) / 2
      game = @game
      if distSquared < minCaptureDist * minCaptureDist # jump to target
        if distSquared < speedSquared
          @set target.x, target.y
        else
          @move @optimalDirection, speed
        target.caughtBy this
        @restTime = 20
      else
        # pursue with a slight wobble and variable speed (faster if closer)
        direction = normalizeDirection(@optimalDirection + @wobble(@pursuitWobble))
        if this isnt game.player
          speed *= (1 + rand() + (1 - pow(min(1, distSquared / game.pursuitThresholdSquared), 2))) / 4
        @move direction, speed
      return

    patrol: ->
      # random direction within patrolWobble of previous direction
      direction = normalizeDirection(@direction + @wobble(@patrolWobble))
      if @target
        # do a slight correction towards target if more than 90deg off
        difference = normalizeDirection(@optimalDirection - direction)
        if abs(difference) > HALF_PI
          direction += (if difference > 0 then 1 else -1) * PI * @game.config.patrolCorrection / 180
      @move direction, @speed / 3
      return

    rest: (duration, required) ->
      if not duration?
        @restTime--
        if not @restTime
          @restRequired = false
      else
        @restTime = duration
        @restRequired = required

    move: (direction, distance) ->
      if frd = @agents.bestMoveFor(this, direction, distance)
        @direction = frd.direction
        @currentSpeed = frd.distance
        @set frd.x, frd.y
      return

    kill: ->
      @set @x, @y, @z, 32, 8
      @alive = false
      @decayTime = @maxDecayTime
      return

    maim: (time) ->
      @set @x, @y, @z, 32, 8
      @totalSleepTime = @sleepTime = floor(time)
      return

    stun: (time) ->
      @rest time, true
      return

    revive: ->
      @set @x, @y, @z, Tracker::size, Tracker::height
      @blood = null

    projectedLocation: (time) ->
      ticks = time / @game.tickTime
      projectedDist = @currentSpeed * ticks
      direction = @direction
      x = @x + projectedDist * cos(direction)
      y = @y + projectedDist * sin(direction)
      {x, y}

  class Zombie extends Tracker
    constructor: (game, target) ->
      super
      @speed = (0.5 * (1 + rand()) * @maxSpeed)
      @speedSquared = @speed * @speed
      @sprite = 1 + floor(rand() * 15)
      @predictFactor = rand() * rand()

    maxSpeed: 6
    zombie: true

  class MouseTarget
    constructor: (game) ->
      @game = game
      board = game.board
      @x = board.width / 2
      @y = board.height / 2
      if game.config.mode is 'observe'
        @mask = document.createElement('canvas')
        @maskContext = @mask.getContext('2d')
        @render = @renderBinoculars
        @renderShadow = ->

    trackable: true
    size: 0

    caughtBy: ->

    set: (@x, @y) ->

    render: ->

    renderShadow: (board) ->
      player = @player ?= @game.player
      return unless player and player.alive and not player.manual and player.currentSpeed
      context = board.context
      context.save()
      context.scale 1, 0.5
      context.globalAlpha = 0.75
      context.beginPath()
      context.translate @x, @y
      context.rotate QUARTER_PI
      context.arc 0, 0, 10, 0, TAU
      context.strokeStyle = '#ccb'
      context.stroke()
      context.fillStyle = '#ccb'
      context.fillRect -20, -1, 40, 3
      context.fillRect -1, -20, 3, 40
      context.restore()

    renderBinoculars: (board) ->
      context = board.context
      canvas = board.canvas
      width = canvas.width
      height = canvas.height
      radius = min(width, height) / 5
      eyeOffset = 0.7
      gradient
      x = @x
      y = @y / 2
      mask = @mask
      maskContext = @maskContext

      mask.width = width
      mask.height = height
      maskContext.clearRect 0, 0, width, height
      gradient = maskContext.createRadialGradient(x - eyeOffset * radius, y, radius * 0.9, x - eyeOffset * radius, y, radius)
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      maskContext.fillStyle = gradient
      maskContext.arc x - eyeOffset * radius, y, radius, 0, TAU
      maskContext.fill()
      gradient = maskContext.createRadialGradient(x + eyeOffset * radius, y, radius * 0.9, x + eyeOffset * radius, y, radius)
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)')
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      maskContext.fillStyle = gradient
      maskContext.arc x + eyeOffset * radius, y, radius, 0, TAU
      maskContext.fill()
      maskContext.globalCompositeOperation = 'xor'
      maskContext.fillStyle = 'rgba(0,0,0,1)'
      maskContext.fillRect 0, 0, width, height
      context.drawImage mask, 0, 0
      return

  class Player extends Tracker
    constructor: (game, mouseTarget) ->
      super
      @set mouseTarget.x, mouseTarget.y
      @speedSquared = @speed * @speed
      @directionKeysPressed = {}
      @weapons = for name in game.config.weapons
        Weapon.factory(name, game, this)
      @weapon = @weapons[0]

    pursuitWobble: 0
    speed: 12
    direction: 0
    sprite: 0

    collisionMechanism: (other) ->
      if other.zombie
        'attack'
      else
        'avoid'

    targetVisible: -> true

    kill: ->
      super
      @weapon.ready = false
      @game.gameOver()
      return

    infect: ->
      @kill()
      @decayTime = 0
      zombie = new Zombie(@game, this)
      zombie.sprite = 0
      zombie.direction = 0
      zombie.set(@x, @y + 1) # js sort isn't stable, so we want the zombie consistently in the front during rest
      zombie.maim(40)
      @agents.push zombie
      return

    caughtBy: ->
      @infect()

    directionKeys:
      37: 'W', # left
      38: 'N', # up
      39: 'E', # right
      40: 'S', # down
      65: 'W', # A
      87: 'N', # W
      68: 'E', # D
      83: 'S'  # S

    inferManualDirection: ->
      directions = {}
      for key of @directionKeysPressed when @directionKeysPressed[key]
        directions[@directionKeys[key]] = 1
      @manualX = if directions.E ^ directions.W then (directions.E or -1) else 0
      @manualY = if directions.S ^ directions.N then (directions.S or -1) else 0
      return

    mouseDown: ->
      if @alive and @weapon.ready and not @sleepTime
        @weapon.fire()
      return

    mouseUp: ->
      if @alive and @weapon.firing and not @sleepTime
        @weapon.fired()
      return

    mouseMove: ->
      if @manual and not @manualX and not @manualY
        @manual = false
      return

    keyDown: (key) ->
      return unless @alive
      if @directionKeys[key]
        @manual = true
        @directionKeysPressed[key] = true
        @inferManualDirection()
      else if @weapon.ready and not @sleepTime
        if key is 32
          @weapon.fire()
        else if key is 188
          @prevWeapon()
        else if key is 190
          @nextWeapon()
      return

    keyUp: (key) ->
      return unless @alive
      if @directionKeys[key]
        @directionKeysPressed[key] = false
        @inferManualDirection()
      else if key is 32 and @weapon.firing
        @weapon.fired()
      return

    prevWeapon: ->
      @weapons.unshift @weapons.pop()
      @weapon = @weapons[0]
      return

    nextWeapon: ->
      @weapons.push @weapons.shift()
      @weapon = @weapons[0]
      return

    renderShadow: (board) ->
      super
      context = board.context
      context.save()
      context.scale 1, 0.5
      context.globalAlpha = 0.25
      context.beginPath()
      context.arc @x, @y, @game.pursuitThreshold, 0, TAU
      context.fillStyle = '#ffe'
      context.fill()
      context.restore()
      return

  class Structure extends Agent
    @register = register
    @factory = factory

    imageXOffset: 0
    imageYOffset: 0
    constructor: (@game, @x, @y) ->
      super
      if @imageSrc
        @image = image = new Image()
        image.src = @imageSrc
      @stacking ?= @y
      @agents.addToSectors this, @sectorRange()
      if slopes = @stackingSlopes
        @agents.addStackingSlopes this, slopes

    structure: true

  class RotatedSquareStructure extends Structure
    checkCollision: (otherX, otherY, otherSize) ->
      diffX = @x - otherX
      diffY = @y - otherY
      distX = abs(diffX)
      distY = abs(diffY)
      manhattanishDist = distX + distY - (otherSize / 2)
      return false if manhattanishDist > @size/2 # distance from center to corner
      {direction: atan2(diffY, diffX), distSquared: distX * distX + distY * distY}

    collisionTangent: (other) ->
      diffX = @x - other.x
      diffY = @y - other.y
      if (diffX < 0) ^ (diffY < 0)
        QUARTER_PI
      else
        -QUARTER_PI

    render: (board) ->
      context = board.context
      context.save()
      context.globalAlpha = 0.9
      context.drawImage @image, @x - @size/2 - @imageXOffset, @y/2 - @imageYOffset
      context.restore()
      return

  class FarmHouse extends RotatedSquareStructure
    size: 434
    imageYOffset: 352
    imageSrc: "images/farmhouse.png"

  class RotatedRectangleStructure extends Structure
    constructor: (game, x, y, slope) ->
      @slope = slope if slope
      @setStacking x, y
      super

    setStacking: (x, y) ->
      l = @lengthComponent / 2
      w = @widthComponent / 2
      @stacking = y - l + w
      if @slope > 0
        @stackingSlopes = [
          [x - l - w, y - l + w, x + l - w, y + l + w]
          [x + l - w, y + l + w, x + 3 * l - w, y - l + w]
        ]
      else
        @stackingSlopes = [
          [x - 3 * l + w, y - l + w, x - l + w, y + l + w]
          [x - l + w, y + l + w, x + l + w, y - l + w]
        ]

    checkCollision: (otherX, otherY, otherSize) ->
      x = otherX - @x
      y = otherY - @y
      length = @lengthComponent + otherSize / 2
      width = @widthComponent + otherSize / 2
      if @slope > 0
        return false if x - y > width or
                        x - y < -width or
                        x + y > length or
                        x + y < -length
      else
        return false if x + y > width or
                        x + y < -width or
                        x - y > length or
                        x - y < -length
      {direction: atan2(-y, -x), distSquared: x*x + y*y}

    collisionTangent: (other) ->
      x = other.x - @x
      y = other.y - @y
      width = @widthComponent
      # TODO: might need slope check
      if x + y >= width or x + y <= -width
        -QUARTER_PI
      else
        QUARTER_PI

    render: (board) ->
      context = board.context
      context.save()
      context.globalAlpha = 0.9
      context.drawImage @image, @x - @imageXOffset, @y/2 - @imageYOffset
      context.restore()
      return

  class MotorHome extends RotatedRectangleStructure
    imageXOffset: 123
    imageYOffset: 146
    imageSrc: "images/motorhome.png"
    lengthComponent: 190
    widthComponent: 55
    size: 245
    slope: -1

  class Tower extends RotatedSquareStructure
    size: 74
    imageXOffset: 36
    imageYOffset: 223
    imageSrc: "images/tower.png"

  class Fence extends RotatedRectangleStructure
    size: 293
    imageXOffset: 149
    imageYOffset: 138
    lengthComponent: 293
    widthComponent: 10
    imageSrc: "images/fence-se.png"

  Structure.register 'farmhouse', FarmHouse
  Structure.register 'motorhome', MotorHome
  Structure.register 'tower', Tower
  Structure.register 'fence', Fence

  window.Zomgbie = Zomgbie
)($)

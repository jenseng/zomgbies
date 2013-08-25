(function($) {

  var sectorSize = 36;
  var pixelsPerMeter = 36;
  var gravity = 9.8 * pixelsPerMeter;

  var abs = Math.abs;
  var cos = Math.cos;
  var sin = Math.sin;
  var atan2 = Math.atan2;
  var rand = Math.random;
  var floor = Math.floor;
  var ceil = Math.ceil;
  var round = Math.round;
  var PI = Math.PI;
  var HALF_PI = PI / 2;
  var TAU = PI * 2;
  var sqrt = Math.sqrt;
  var SQRT_2 = sqrt(2);
  var min = Math.min;
  var max = Math.max;
  var pow = Math.pow;

  // totally useless "accessibility"
  var $status = $("<div>", {style: "position: relative; z-index: -1; overflow: hidden; width: 0; height: 0;", "aria-live": "polite", "role": "log"}).appendTo($(document.body));
  var lastRead;
  function read(text) {
    var now = new Date().getTime();
    if (!lastRead || now > lastRead + 1000) {
      lastRead = now;
      $status.text(text);
    }
  }

  function pick() {
    return arguments[floor(rand() * arguments.length)];
  }

  function makeObservation() {
    read(pick(
      "this is terrifying",
      "you're not doing very well",
      "this is hard to watch",
      "not bad",
      "pro tip: kill the zombies",
      "nicely done",
      "watch out",
      "look out",
      "here they come",
      "lol",
      "wow",
      "haha",
      "that was amazing",
      "good job",
      "gotta be quick",
      "you've got this",
      "you're a natural",
      "does my voice sound weird to you?",
      "i've got a bad feeling about this",
      "nice shooting, tex"));
    setTimeout(makeObservation, 5000 + 1000 * floor(rand() * 20));
  }
  setTimeout(makeObservation, 10000);

  function normalizeDirection(direction) {
    if (direction > PI)
      direction -= TAU;
    else if (direction < -PI)
      direction += TAU;
    return direction;
  }

  function hypotenuse(a, b) {
    return sqrt(a * a + b * b);
  }

  function checkCollision(otherX, otherY, otherSize, otherZ, otherHeight) {
    var distY = abs(this.y - otherY),
        minDist = (this.size + otherSize) / 2,
        minDistSquared = minDist * minDist;
    if (distY > minDist) return false;

    var distX = abs(this.x - otherX);
    if (distX > minDist) return false;

    var distSquared = distX * distX + distY * distY;
    if (distSquared > minDistSquared) return false;

    if (this.z !== otherZ && (this.z + this.height < otherZ || otherZ + otherHeight < this.z)) return false;

    return {direction: atan2(distY, distX), distSquared: distSquared};
  }

  function sectorCoord(n) {
    return floor(n / sectorSize);
  }

  function sectorRange(x, size) {
    if (typeof x === 'undefined') x = this.x;
    if (typeof size === 'undefined') size = this.size;
    if (typeof x === 'undefined') return null;
    return [sectorCoord(x - size / 2), sectorCoord(x + size / 2)];
  }

  function sum(array) {
    var sum = 0;
    for (var i = 0; i < array.length; i++)
      sum += array[i];
    return sum;
  }

  var Zomgbie = function($canvas, options){
    new Game($canvas, options).run();
  };

  var Game = function($canvas, options) {
    this.config = $.extend({}, this.config, options, true);

    this.$canvas = $canvas;
    this.board = new Board(this, $canvas);
    this.agents = new AgentList(this);
    this.mouseTarget = new MouseTarget(this.board);
    if (this.config.mode === 'observe') {
      this.config.patrolCorrection = 1;
      this.config.pursueTargets = false;
      this.addAllZombies();
    }
    else {
      this.stats = new Stats(this);
      this.player = new Player(this, this.mouseTarget);
      this.agents.push(this.player);
    }
    this.addListeners($canvas);

    this.setPursuitThreshold(this.config.pursuitThreshold);
    this.tickTime = floor(1000 / this.config.ticksPerSecond);
  };
  Game.prototype = {
    config: {
      ticksPerSecond: 30,
      maxZombies: 100,
      maxSpawnsPerTick: 50,
      pursuitThreshold: 200,
      patrolCorrection: 3,
      pursueTargets: true,
      mode: 'play',
      weapons: ['colt'] // sword | grenades
    },
    addListeners: function() {
      var $doc = $(document);

      this.$canvas.on('mousemove', function(e) {
        this.mouseTarget.set(e.clientX + 20, e.clientY * 2 + 160);
        if (this.player)
          this.player.mouseMove();
      }.bind(this));

      this.$canvas.on('mousedown', function(e) {
        this.mouseTarget.set(e.clientX + 20, e.clientY * 2 + 160);
        if (this.player)
          this.player.mouseDown();
      }.bind(this));

      this.$canvas.on('mouseup', function(e) {
        this.mouseTarget.set(e.clientX + 20, e.clientY * 2 + 160);
        if (this.player)
          this.player.mouseUp();
      }.bind(this));

      $doc.on('keydown', this.keyDown.bind(this));
      $doc.on('keyup', this.keyUp.bind(this));

      if (this.config.resize) {
        var $window = $(window);
        $window.on('resize', this.board.resize.bind(this.board));
      }
    },
    keyDown: function(e) {
      var key = e.which;
      if (this.player) this.player.keyDown(key);
    },
    keyUp: function(e) {
      var key = e.which;
      if (this.player) this.player.keyUp(key);
    },
    times: {run: [], render: []},
    time: function(label, code) {
      var start = new Date().getTime();
      code.call(this);
      var times = this.times[label];
      if (times.length > 100)
        times.shift();
      times.push(new Date().getTime() - start);
    },
    run: function() {
      if (!this.times.nextTick)
        this.times.nextTick = this.times.started = new Date().getTime();
      this.times.nextTick += this.tickTime;

      this.time('run', function() {
        this.maybeAddZombies();
        this.agents.move();

        this.agents.sort();
      });

      this.time('render', function() {
        if (this.player)
          this.board.render(this.agents, this.player.weapons, this.stats);
        else
          this.board.render(this.agents, this.mouseTarget);
      });
      if (this.pursuitThreshold > this.config.pursuitThreshold)
        this.setPursuitThreshold(this.pursuitThreshold - 2);
      setTimeout(this.run.bind(this), this.times.nextTick - new Date().getTime());
    },
    addAllZombies: function() {
      for (var i = 0; i < this.config.maxZombies; i++) {
        zombie = new Zombie(this, this.mouseTarget);
        zombie.randomStart(this.board);
        this.agents.push(zombie);
      }
    },
    maybeAddZombies: function() {
      var zombie,
          agents = this.agents,
          config = this.config,
          numZombies = agents.numZombies,
          maxZombies = config.maxZombies,
          toAdd;
      if (numZombies < maxZombies && rand() * 80 < 1) {
        toAdd = min(ceil(rand() * config.maxSpawnsPerTick), maxZombies - numZombies);
        if (rand() < 0.2) {
          if (toAdd === 1)
            read(numZombies === 0 ? "zombie" : pick("another zombie", "yet another", "zombie", "walker"));
          else if (toAdd < 4)
            read(pick("zombies", "here they come", "here come a couple", "yikes"));
          else
            read(pick("uh oh", "oh no", "damn", "oh crap a lot of zombies", "here comes the horde", "whoa that's a lot", "they just keep coming"));
        }
        for (var i = 0; i < toAdd; i++) {
          zombie = new Zombie(this, this.player);
          zombie.randomEdgeStart(this.board);
          this.agents.push(zombie);
        }
      }
    },
    gameOver: function() {
      var messages = this.config.messages.gameOver,
          message = pick.apply(window, messages);
      read("game over. " + message);
      read = function(){};
      this.stats.setStatus(message);
    },
    setPursuitThreshold: function(newVal) {
      this.pursuitThreshold = newVal;
      this.pursuitThresholdSquared = newVal * newVal;
    },
    noise: function(factor) {
      if (typeof factor === 'undefined') factor = 1;
      this.setPursuitThreshold(min(this.pursuitThreshold + factor * this.config.pursuitThreshold, 3 * this.config.pursuitThreshold));
    }
  };

  var Board = function(game, $canvas) {
    this.game = game;
    this.canvas = $canvas[0];
    this.context = this.canvas.getContext('2d');
    this.resize();
  };
  Board.prototype = {
    resize: function() {
      this.canvas.width = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;
      this.width = this.canvas.width;
      this.height = this.canvas.height * 2;
    },
    renderRadius: function() {
      var context = this.context,
          game = this.game,
          player = game.player;
      context.save();
      context.scale(1, 0.5);
      context.globalAlpha = 0.25;
      context.beginPath();
      // TODO should y really use size?
      context.arc(player.x, player.y - player.size, game.pursuitThreshold, 0, TAU);
      context.fillStyle = '#ffd';
      context.fill();
      context.restore();
    },
    render: function() {
      this.context.clearRect(0, 0, this.width, this.height);
      var args = [].slice.call(arguments),
          len = args.length,
          args2,
          len2,
          player = this.game.player;
      if (player && player.alive)
        this.renderRadius();
      for (var i = 0; i < len; i++) {
        if (args[i].render) {
          args[i].render(this);
        }
        else {
          args2 = args[i];
          len2 = args2.length;
          for (var j = 0; j < len2; j++) {
            args2[j].render(this);
          }
        }
      }
    }
  };

  var Stats = function(game) {
    this.game = game;
  };
  Stats.prototype = {
    kills: 0,
    killStreak: 0,
    maxKillStreak: 0,
    maxCombo: 0,
    hitRatio: 0,
    totalShots: 0,
    totalHitShots: 0,
    maxStatusTime: 150,
    addShotInfo: function(kills) {
      this.totalShots++;
      if (kills > 1 && kills > this.maxCombo)
        this.maxCombo = kills;
      this.kills += kills;
      if (kills) {
        this.totalHitShots++;
        this.killStreak += kills;
        if (this.killStreak > this.maxKillStreak)
          this.maxKillStreak = this.killStreak;
      }
      else {
        this.killStreak = 0;
      }
      this.hitRatio = this.totalHitShots / this.totalShots;
    },
    setStatus: function(message) {
      this.status = message;
      this.statusTime = this.maxStatusTime;
    },
    renderLines: function(context, board, alignment, lines){
      var x,
          y;
      context.textAlign = alignment;
      for (i = 0; i < lines.length; i++) {
        x = alignment === 'left' ? 10 : board.canvas.width - 10;
        y = board.canvas.height - 10 - 30 * (lines.length - 1) + i * 30;
        context.fillText(lines[i], x, y);
        context.strokeText(lines[i], x, y);
      }
    },
    renderText: function(board, text, lineHeight, xAlign, yAlign) {
      var canvas = board.canvas,
          context = board.context,
          lines = text.split("\n"),
          newLines,
          metrics,
          height,
          x = 10,
          y = 5,
          i;
      for (i = 0; i < lines.length; i++) {
        metrics = context.measureText(lines[i]);
        if (metrics.width >= canvas.width) {
          newLines = this.wrapText(canvas, context, lines[i]);
          newLines.splice(0, 0, i, 1);
          i += newLines.length - 1;
          lines.splice.apply(lines, newLines);
        }
      }
      height = lines.length * lineHeight;
      if (xAlign === 'center')
        x = canvas.width / 2;
      else if (xAlign === 'right')
        x = canvas.width - 10;
      if (yAlign === 'center')
        y = (canvas.height - height) / 2;
      else if (yAlign === 'bottom')
        y = canvas.height - height - 5;

      context.textAlign = xAlign;
      for (i = 0; i < lines.length; i++) {
        context.fillText(lines[i], x, y);
        context.strokeText(lines[i], x, y);
        y += lineHeight;
      }
    },
    wrapText: function(canvas, context, text) {
      var words = text.split(/\s/),
          lines = [],
          line = '',
          testLine,
          metrics;
      for (var i = 0; i < words.length; i++) {
        testLine = line + words[i] + ' ';
        metrics = context.measureText(testLine);
        if (line && metrics.width > canvas.width) {
          lines.push(line);
          line = words[i] + ' ';
        }
        else {
          line = testLine;
        }
      }
      lines.push(line);
      return lines;
    },
    renderDebug: function(board) {
      var sectors = this.game.agents.sectors;
          sectorCount = 0;
      for (var sector in sectors)
        sectorCount++;
      this.renderText(
        board,
        "sectors: " + sectorCount + "\n" +
        "agents: " + this.game.agents.length + "\n" +
        "run: " + (sum(this.game.times.run) / this.game.tickTime).toFixed(2) + "%\n" +
        "render: " + (sum(this.game.times.render) / this.game.tickTime).toFixed(2) + "%",
        30,
        "left",
        "top");
    },
    render: function(board) {
      var canvas = board.canvas,
          context = board.context,
          player = this.game.player,
          x,
          y,
          i,
          lines;
      context.save();
      context.font = "bold 24px sans-serif";
      context.textBaseline = "top";
      context.globalAlpha = 0.6;
      context.fillStyle = player.alive ? '#800' : '#333';
      context.strokeStyle = '#000';
      if (this.game.config.debug)
        this.renderDebug(board);
      this.renderText(board, "kills: " + this.kills + "\nstreak: " + this.killStreak + " (" + this.maxKillStreak + ")\ncombo: " + this.maxCombo, 30, "left", "bottom");
      this.renderText(board, "walkers: " + this.game.agents.numZombies + "\n< weapon: " + player.weapon.name + " >\nammo: " + (player.weapon.shots ? player.weapon.shots : "...") + (player.weapon.cache ? " / " + player.weapon.cache : ""), 30, "right", "bottom");
      if (this.statusTime) {
        context.font = "bold 36px sans-serif";
        context.globalAlpha = 0.6 * min(1, 4 * this.statusTime / this.maxStatusTime);
        this.renderText(board, this.status, 42, "center", "center");
        this.statusTime--;
      }
      context.restore();
    }
  };

  function AgentList(game){
    this.game = game;
    this.sectors = {};
  }
  AgentList.prototype = {
    byStacking: [],
    byDistance: [],
    length: 0,
    push: function(item) {
      this.length++;
      this.byDistance.push(item);
      this.byStacking.push(item);
    },
    sort: function() {
      var byDistance = this.byDistance,
          byStacking = this.byStacking,
          len = this.length,
          i;
      byDistance.sort(function(a, b) {
        return a.distSquaredFrd - b.distSquaredFrd;
      });
      byStacking.sort(function(a, b) {
        return a.y - b.y;
      });
      for (i = 0; i < len; i++) {
        byDistance[i].distanceIdx = i;
        byStacking[i].stackingIdx = i;
      }
    },
    numZombies: 0,
    remove: function(agent) {
      var i,
          len = --this.length,
          byDistance = this.byDistance,
          byStacking = this.byStacking;
      byDistance.splice(agent.distanceIdx, 1);
      for (i = agent.distanceIdx; i < len; i++)
        byDistance[i].distanceIdx--;
      byStacking.splice(agent.stackingIdx, 1);
      for (i = agent.stackingIdx; i < len; i++)
        byStacking[i].stackingIdx--;
      this.removeFromSectors(agent, agent.sectorRange());
    },
    bestMoveFor: function(agent, direction, distance) {
      var currDir,
          currDist,
          currMove,
          collision,
          factor = rand() > 0.5 ? 1 : -1; // so we alternate between left/right
      // try 7 directions at 4 decreasing speeds, starting w/ desired vector
      for (var i = 0; i < 4; i++) {
        currDist = (4 - i) / 4 * distance;
        for (var j = 0; j < 7; j++) {
          // 0 / 45 / -45 / 90 / - 90
          currDir = normalizeDirection(direction + factor * (j % 2 === 0 ? 1 : -1) * round(j / 2 + 0.25) * PI / 4);
          currMove = this.validMoveFor(agent, currDir, currDist);
          if (currMove) {
            if (i > 0 || j > 0) {
              if (agent.deviations > 2) { // don't want to ping pong forever, take a breather
                agent.rest(floor(rand() * 20), true);
                break;
              }
              agent.deviations++;
            }
            else {
              agent.deviations = 0;
            }
            return {
              distance: currDist * currMove.factor,
              direction: currDir,
              x: currMove.x,
              y: currMove.y
            };
          }
        }
      }
      // then see if we already overlap (due to spawn/bug/whatever), and if so, flee nearest neighbor at 1/2 impulse (overlap be damned)
      collision = this.closestCollision(agent);
      if (collision) {
        currDir = normalizeDirection(PI + collision.direction);
        return {
          distance: distance,
          direction: currDir,
          x: agent.x + 0.5 * distance * cos(currDir),
          y: agent.y + 0.5 * distance * sin(currDir)
        };
      }
      // we're surrounded but not overlapping, wait a tick for neighbors to leave
      return null;
    },
    collisionsFor: function(agent, x, y, size) {
      if (typeof x === 'undefined') x = agent.x;
      if (typeof y === 'undefined') y = agent.y;
      if (typeof size === 'undefined') size = agent.size;
      var z = agent.z,
          height = agent.height,
          range = agent.sectorRange(x, size),
          sectors = this.sectors,
          sector,
          other,
          collision,
          collisions = [],
          dist,
          seen = {};
      for (var i = range[0], last = range[1]; i <= last; i++) {
        sector = this.sectors[i];
        if (!sector) continue;
        for (var j = 0, len = sector.length; j < len; j++) {
          other = sector[j];
          if (other === agent || seen[other.distanceIdx]) continue;
          seen[other.distanceIdx] = true;
          collision = other.checkCollision(x, y, size, z, height);
          if (collision)
            collisions.push({agent: other, distSquared: collision.distSquared, direction: collision.direction});
        }
      }
      return collisions;
    },
    closestCollision: function(agent) {
      var collisions = this.collisionsFor(agent);
      if (collisions.length > 1) {
        collisions.sort(function(a, b) {
          return a.distSquared - b.distSquared;
        });
      }
      return collisions[0];
    },
    validMoveFor: function(agent, direction, distance) {
      var x = agent.x + distance * cos(direction),
          y = agent.y + distance * sin(direction),
          factor = 1,
          other;
      if (agent !== this.game.player) {
        var collisions = this.collisionsFor(agent, x, y),
            len = collisions.length;
        if (len) {
          for (var i = 0; i < len; i++) {
            other = collisions[i].agent;
            if (other.decayTime) // can walk over bodies, but slowly
              factor = 0.2 * other.decayTime / other.maxDecayTime;
            else if (other.sleepTime)
              factor = 0.2;
            else // otherwise legit collision, turn around
              return false;
          }
        }
      }
      return {x: x, y: y, factor: factor};
    },
    set: function(agent, x, y, z, size) {
      if (typeof z === 'undefined') z = agent.z;
      if (typeof size === 'undefined') size = agent.size;
      if (agent.x === x && agent.y === y && agent.z === z && agent.size === size) return;
      var rangeOld = agent.sectorRange();
      agent.x = x;
      agent.y = y;
      agent.z = z;
      agent.size = size;
      if (rangeOld)
        this.setSectors(agent, rangeOld, agent.sectorRange());
      else
        this.addToSectors(agent, agent.sectorRange());
    },
    setSectors: function(agent, rangeOld, range) {
      var oldStart = rangeOld[0],
          oldEnd = rangeOld[1],
          newStart = range[0],
          newEnd = range[1],
          sectors = this.sectors,
          sector;
      if (oldStart === newStart && oldEnd === newEnd)
        return;
      if (oldStart < newStart)
        this.removeFromSectors(agent, [oldStart, min(newStart - 1, oldEnd)]);
      else if (oldStart > newStart)
        this.addToSectors(agent, [newStart, min(oldStart - 1, newEnd)]);

      if (oldEnd > newEnd)
        this.removeFromSectors(agent, [max(oldStart, newEnd + 1), oldEnd]);
      else if (oldEnd < newEnd)
        this.addToSectors(agent, [max(newStart, oldEnd + 1), newEnd]);
    },
    addToSectors: function(agent, range) {
      var sectors = this.sectors,
          sector;
      for (var i = range[0], last = range[1]; i <= last; i++) {
        sector = sectors[i] || (sectors[i] = []);
        sector.push(agent);
      }
    },
    removeFromSectors: function(agent, range) {
      var sectors = this.sectors,
          sector;
      for (var i = range[0], last = range[1]; i <= last; i++) {
        sector = sectors[i];
        sector.splice(sector.indexOf(agent), 1);
        if (!sector.length) delete sectors[i];
      }
    },
    move: function() {
      var agent,
          numZombies = 0,
          byDistance = this.byDistance,
          len = this.length;
      for (var i = 0; i < len; i++) {
        // closest ones get to move first
        agent = byDistance[i];
        if (!agent.nextMove()) {
          this.remove(agent);
          i--;
          len--;
        }
        else if (agent.alive && agent.zombie) {
          numZombies++;
        }
      }
      this.numZombies = numZombies;
    },
    render: function(board) {
      var byStacking = this.byStacking,
          len = this.length;
      for (var i = 0; i < len; i++) {
        byStacking[i].render(board);
      }
    }
  };

  function Weapon(game, player) {
    this.game = game;
    this.player = player;
  }
  Weapon.factory = function(name, game, player) {
    var constructor = {
      'colt': Colt,
      'sword': Sword,
      'grenades': Grenades
    }[name];
    var weapon = new constructor(game, player);
    weapon.name = name;
    return weapon;
  };
  Weapon.prototype = {
    ready: true,
    disable: function(time, callback) {
      this.ready = false;
      setTimeout(function() {
        if (this.player.alive)
          this.ready = true;
        callback.call(this);
      }.bind(this), time);
    },
    closest: function() {
      var closest = null,
          agents = this.game.agents,
          len = agents.length,
          byDistance = agents.byDistance,
          agent;
      for (var i = 0; i < len; i++) {
        agent = byDistance[i];
        if (agent.alive && agent.zombie) {
          closest = agent;
          break;
        }
      }
      return closest;
    },
    render: function() {},
    nextMove: function() {},
    fire: function() {},
    fired: function() {}
  };

  function Grenade(game) {
    this.game = game;
    this.player = game.player;
    this.pulledPin = new Date().getTime();
    this.gravityPerTick = gravity / game.config.ticksPerSecond;
    // TODO pin sound
    setTimeout(this.explode.bind(this), this.timeToExplode);
  }
  Grenade.prototype = {
    timeToExplode: 1500,
    trackable: true,
    killRadiusSquared: 60 * 60,
    maimRadiusSquared: 120 * 120,
    stunRadiusSquared: 200 * 200,
    distractDiameter: 1000,
    speed: 64,
    size: 6,
    decel: 12, // when it hits the ground
    object: true,
    distance: 0,
    throwAt: function(target) {
      if (this.exploded)
        return;

      var optimalSpeed,
          optimalSpeedSide,
          inertia, // directional component of player's inertia (i.e. you can throw further in the direction you are going)
          relativeOptimalSpeed, // from the perspective of the player
          maxSpeed,
          player = this.player;

      this.thrown = true;
      this.set(player.x, player.y, 64); // shoulder height
      this.game.agents.push(this);

      if (target) {
        var time = (this.timeToExplode + this.pulledPin - new Date().getTime());
        var orig = target;
        target = target.projectedLocation(this.timeToExplode + this.pulledPin - new Date().getTime());
        var distX = target.x - this.x;
        var distY = target.y - this.y;
        var dist = hypotenuse(distX, distY);
        optimalSpeed = sqrt(dist * this.gravityPerTick) * 0.85; // fudge factor due to drop and roll
        this.direction = atan2(distY, distX);
      }
      else { // no target, just throw it far
        optimalSpeed = this.speed;
        this.direction = normalizeDirection(rand() * TAU);
      }
      optimalSpeedSide = optimalSpeed / SQRT_2; // get the v/h speed (same, since 45 deg is optimal)
      inertia = player.currentSpeed * cos(player.direction - this.direction);
      relativeOptimalSpeed = hypotenuse(optimalSpeedSide, optimalSpeedSide - inertia);
      maxSpeed = this.speed * (optimalSpeed / relativeOptimalSpeed);
      if (optimalSpeed > maxSpeed)
        optimalSpeedSide *= maxSpeed / optimalSpeed;
      this.zSpeed = optimalSpeedSide;
      this.speed = optimalSpeedSide;

      // TODO maybe if close enough, bean zombie in head?
      // TODO throw sound
      if (rand() < 0.25)
        read(pick("nice throw", "good arm", "good throw", "nice", "you're nolan ryan"));
    },
    checkCollision: checkCollision,
    explode: function() {
      var agents = this.game.agents;

      // TODO explode sound
      if (!this.thrown) { // oh crap, didn't throw it!
        var player = this.player;
        this.thrown = true;
        this.set(player.x, player.y, 0);
        agents.push(this);
      }
      this.speed = 0;
      this.zSpeed = 0;
      this.exploded = true;
      this.explodeTime = 30;
    },
    caughtBy: function(agent) {
      if (agent.distractTime)
        agent.distractTime = 1;
    },
    set: function(x, y, z, size) {
      this.game.agents.set(this, x, y, z, size);
    },
    nextMove: function() {
      var explodeTime = this.explodeTime;
      if (explodeTime) {
        if (explodeTime === 30) {
          this.set(this.x, this.y, this.z, 96);
          var hitCount = 0,
              player = this.player,
              killRadiusSquared = this.killRadiusSquared,
              maimRadiusSquared = this.maimRadiusSquared,
              stunRadiusSquared = this.stunRadiusSquared,
              distractDiameter = this.distractDiameter,
              game = this.game,
              casualties = game.agents.collisionsFor(this, this.x, this.y, distractDiameter),
              info,
              agent;
          for (var i = 0, len = casualties.length; i < len; i++) {
            info = casualties[i];
            agent = info.agent;
            if (!agent.alive) continue;
            if (info.distSquared < killRadiusSquared) {
              agent.kill();
            }
            else if (info.distSquared < maimRadiusSquared) {
              agent.maim(floor(50 + 100 * (1 - info.distSquared / maimRadiusSquared)));
            }
            else if (agent !== this.player) {
              if (info.distSquared < stunRadiusSquared)
                agent.stun(floor(25 + 50 * (1 - info.distSquared / stunRadiusSquared)));
              else
                agent.distract(this, 60 + floor(60 * rand()), distractDiameter);
            }
          }
          game.noise(0.5);
          read(pick("hahaha", "awesome, " + hitCount, "got " + hitCount, "haha, you blew up " + hitCount, "ha, got " + hitCount, "that'll teach them", "it's raining arms", "i love grenades"));
        }
        this.explodeTime--;
      }
      else if (this.speed > 0) {
        this.z += this.zSpeed;
        if (this.z <= 0) {
          if (this.gravityPerTick) {
            // TODO hit ground sound
            this.gravityPerTick = 0;
          }
          this.z = 0;
          this.speed -= this.decel;
          if (this.speed < 0) this.speed = 0;
        }
        else {
          this.zSpeed -= this.gravityPerTick;
        }
        this.set(this.x + this.speed * cos(this.direction), this.y + this.speed * sin(this.direction));
      }
      return !this.exploded || this.explodeTime;
    },
    render: function(board) {
      var context = board.context;
      if (this.exploded) {
        context.save();
        var animationTime = max(0, this.explodeTime - 15);
        var fade = animationTime < 12 ? animationTime / 12 : 1;
        fade = fade*fade*fade;
        context.globalAlpha = fade;
        var size = animationTime > 10 ?
          3 * (16 - animationTime):
          5 + animationTime / 2;
        var circles = size * 4;
        for (var i = 0; i < circles; i++) {
          context.beginPath();
          var rad = (1 + 2 * rand()) * size;
          var x = (5 - 10 * rand()) * size;
          var y = (2 - 4 * rand()) * size;
          y -= (1 - animationTime / 15) * 200;
          context.arc(this.x + x, this.y / 2 - this.z + y, rad, 0, TAU);
          var gray = (1 - fade) * (96 + rand() * 128);
          var r = floor(gray + fade * 255);
          var g = floor(gray + fade * (192 + rand() * 64));
          var b = floor(gray + fade * (rand() * 128));
          var opacity = 0.5 * rand() + 0.1;
          context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
          context.fill();
          //context.strokeStyle = 'rgba(' + floor(r*0.9) + ',' + floor(g*0.9) + ',' + floor(b*0.9) + ',1)';
          //context.stroke();
        }
        context.restore();
      }
      else {
        context.beginPath();
        context.arc(this.x, this.y / 2 - this.z, 3, 0, TAU);
        context.fillStyle = '#080';
        context.fill();
        context.strokeStyle = '#000';
        context.stroke();
      }
    },
    timeToThrow: function() {
      var elapsed = new Date().getTime() - this.pulledPin;
      return 500 - elapsed;
    },
    sectorRange: sectorRange
  };

  function Grenades(game, player) {
    Weapon.call(this, game, player);
  }
  Grenades.prototype = new Weapon;
  $.extend(Grenades.prototype, {
    shots: '∞',
    fire: function() {
      this.grenade = new Grenade(this.game);
      this.firing = true;
      this.ready = false;
    },
    fired: function() {
      if (!this.firing) return;
      var grenade = this.grenade,
          wait = grenade.timeToThrow();
      if (wait > 0) {
        setTimeout(this.fired.bind(this), wait);
      }
      else {
        grenade.throwAt(this.closest());
        this.firing = false;
        this.ready = true;
      }
    }
  });

  function Sword(game, player) {
    Weapon.call(this, game, player);
  }
  Sword.prototype = new Weapon;
  $.extend(Sword.prototype, {
    shots: '∞',
    fire: function() {
    },
    render: function(board) {
    }
  });

  function Colt(game, player){
    Weapon.call(this, game, player);
    this.sounds = {
      fire: $('<audio src="audio/colt.mp3" preload="auto"></audio>')[0],
      reload: $('<audio src="audio/reload.m4a" preload="auto"></audio>')[0]
    };
  }
  Colt.prototype = new Weapon;
  $.extend(Colt.prototype, {
    shots: 6,
    cache: '∞',
    maxVisibleTime: 5,
    fire: function() {
      var closest = this.closest(),
          direction = rand() * TAU,
          player = this.player,
          game = this.game,
          agents = game.agents,
          byDistance = agents.byDistance,
          len = agents.length,
          fire = this.sounds.fire,
          agent,
          hitMargin,
          offBy,
          hitCount = 0,
          sound;

      game.noise();

      if (closest) {
        direction = closest.optimalDirection;
        direction += PI * (rand() / 45 - 1 / 90); // off by up to 3 degrees
        for (var i = 0; i < len; i++) {
          agent = byDistance[i];
          if (agent === player || !agent.alive)
            continue;
          // will the shot hit this zombie?
          hitMargin = abs(atan2(agent.size / 4, sqrt(agent.distSquaredFrd)));
          offBy =  abs(agent.optimalDirection - direction);
          if (offBy < hitMargin) {
            hitCount++;
            agent.kill();
          }
        }
      }
      game.stats.addShotInfo(hitCount);
      direction = normalizeDirection(direction + PI);
      this.lastShot = {x: player.x, y: player.y, direction: direction, visibleTime: this.maxVisibleTime};
      this.shots--;
      read(hitCount === 0 ? pick("miss", "whiff", "so close", "next time") : hitCount === 1 ? pick("nice shot", "got one", "got 'em", "haha", "headshot") : pick("oh wow", "got " + hitCount, "mega kill", hitCount + " for 1", "haha, amazing"));
      fire.load();
      fire.play();
      this.disable(800, function() {
        if (!this.shots)
          this.reload();
      });
    },
    reload: function() {
      var reload = this.sounds.reload;
      read(pick("reload quick", "quick", "hurry", "c'mon", "let's go", "faster", "oh man"));
      reload.load();
      reload.play();
      this.disable(3000, function() {
        this.shots = 6;
      });
    },
    render: function(board) {
      var context = board.context,
          lastShot = this.lastShot;
      if (lastShot && lastShot.visibleTime) {
        var x = lastShot.x,
            y = lastShot.y,
            direction = lastShot.direction;
        context.save();
        context.beginPath();
        context.moveTo(lastShot.x, lastShot.y / 2 - 40); // shot fired from 5/9 up player
        context.lineTo(lastShot.x + 600 * cos(lastShot.direction), (lastShot.y + 600 * sin(lastShot.direction)) / 2 - 56); // end of stroke is 7/9 up (through head of zombies)
        context.strokeStyle = '#ccc';
        context.globalAlpha = lastShot.visibleTime / this.maxVisibleTime;
        context.stroke();
        context.restore();
        lastShot.visibleTime--;
      }
    }
  });

  function Tracker(game, target) {
    this.game = game;
    this.agents = game ? game.agents : null;
    this.target = target;
  }
  Tracker.prototype = {
    alive: true,
    trackable: true,
    size: 24,
    pursuitWobble: 10,
    patrolWobble: 30,
    maxDecayTime: 160,
    deviations: 0,
    randomStart: function(board) {
      this.direction = normalizeDirection(rand() * TAU);
      this.set(rand() * board.width, rand() * board.height);
    },
    randomEdgeStart: function(board) {
      var sprite = this.game.config.sprites[this.sprite],
          width = board.width,
          height = board.height,
          startPos = rand() * 2 * (width + height);
      if (startPos < width) {
        this.direction = HALF_PI;
        this.set(startPos, 0);
      }
      else if (startPos < width + height) {
        this.direction = PI;
        this.set(width + sprite.width / 2, startPos - width);
      }
      else if (startPos < 2 * width + height) {
        this.direction = 3 * HALF_PI;
        this.set(startPos - width - height, height + sprite.height * 2);
      }
      else {
        this.direction = 0;
        this.set(-sprite.width / 2, startPos - 2 * width - height);
      }
    },
    render: function(board) {
      var context = board.context,
          sprite = this.game.config.sprites[this.sprite],
          decayTime = this.decayTime,
          maxDecayTime = this.maxDecayTime;
      if (!this.alive && !decayTime)
        return;
      if (decayTime || this.sleepTime) {
        context.save();
        if (decayTime)
          context.globalAlpha = decayTime > maxDecayTime / 2 ? 1 : 2 * decayTime / maxDecayTime;
        context.translate(round(this.x), round(this.y / 2));
        context.rotate(HALF_PI);
        context.drawImage(sprite, -sprite.width, -sprite.height / 2);
        context.restore();
      }
      else {
        context.drawImage(sprite, round(this.x - sprite.width / 2), round(this.y / 2 - sprite.height));
      }
    },
    sectorRange: sectorRange,
    nextMove: function() {
      this.currentSpeed = 0;
      if (!this.alive) {
        if (this.decayTime)
          this.decayTime--;
        return this.decayTime; // if zero, time to remove it
      }

      this.checkProximity();

      if (this.sleepTime)
        this.sleepTime--;
      else if (this.manual && !this.restRequired)
        this.manualMove();
      else if (this.game.config.pursueTargets && this.targetVisible() && !this.restRequired)
        this.pursue();
      else if (this.restTime)
        this.rest();
      else if (rand() < 0.02)
        this.rest(ceil(rand() * 40));
      else
        this.patrol();
      return true;
    },
    targetVisible: function() {
      var target = this.target,
          game = this.game,
          threshold = this.pursuitThreshold || game.pursuitThreshold,
          distX = this.distX,
          distY = this.distY,
          dist;

      if (!target || target.alive === false) return false;
      if (distX > threshold || distX < -threshold) return false;
      if (distY > threshold || distY < -threshold) return false;
      return this.distSquared < (this.pursuitThresholdSquared || game.pursuitThresholdSquared);
    },
    distract: function(fakeTarget, distractTime, distractRadius) {
      this.targetTrackTime = this.distractTime = distractTime;
      this.pursuitThreshold = distractRadius;
      this.pursuitThresholdSquared = distractRadius * distractRadius;
      if (!this.targetFrd)
        this.targetFrd = this.target;
      this.target = fakeTarget;
    },
    checkCollision: checkCollision,
    checkProximity: function() {
      var target = this.target;
      if (target && target.trackable) {
        var x = this.x,
            y = this.y,
            distX,
            distY,
            optimalDirection;
        if (this.distractTime) {
          var targetFrd = this.targetFrd;
          if (!targetFrd) debugger;
          if (--this.distractTime) {
            distX = targetFrd.x - x;
            distY = targetFrd.y - y;
            this.distSquaredFrd = (distX * distX + distY * distY);
          } else {
            // back on track
            this.target = target = targetFrd;
            this.targetFrd = null;
            this.pursuitThreshold = null;
            this.pursuitThresholdSquared = null;
          }
        }
        distX = this.distX = target.x - x;
        distY = this.distY = target.y - y;
        optimalDirection = this.optimalDirection = atan2(distY, distX);
        this.distSquared = (distX * distX + distY * distY);
        if (!this.distractTime)
          this.distSquaredFrd = this.distSquared;
        if (this.predictFactor && target.currentSpeed) {
          var correction;
          // target fleeing?
          if (abs(normalizeDirection(this.optimalDirection - target.direction)) < HALF_PI) {
            var projected = target.projectedLocation(500);
            correction = this.predictFactor * normalizeDirection(atan2(projected.y - y, projected.x - x) - optimalDirection);
          }
          else { // try to intercept (not perfect, since speeds don't match, but zombies aren't *that* smart)
            correction = this.predictFactor * normalizeDirection(PI - (target.direction - optimalDirection));
          }
          this.optimalDirection = normalizeDirection(optimalDirection + correction);
        }
      }
      else {
        this.targetTrackTime = 0;
      }
    },
    wobble: function(degrees) {
      if (!degrees) return 0;
      return PI * (rand() * degrees / 90 - degrees / 180);
    },
    manualMove: function() {
      var direction = normalizeDirection(atan2(this.manualY, this.manualX));
      if (this.manualX || this.manualY)
        this.move(direction, this.speed);
    },
    pursue: function() {
      // TODO: not quite right
      if (this.targetTrackTime)
        this.targetTrackTime--;
      else
        this.targetTrackTime = 120;
      var target = this.target,
          distSquared = this.distSquared,
          speed = this.speed,
          speedSquared = this.speedSquared,
          minCaptureDist = speed + (this.size + target.size) / 2,
          game = this.game;
      if (distSquared < minCaptureDist * minCaptureDist) { // jump to target
        if (distSquared < speedSquared)
          this.set(target.x, target.y);
        else
          this.move(this.optimalDirection, speed);
        target.caughtBy(this);
        this.restTime = 20;
      }
      else {
        // pursue with a slight wobble and variable speed (faster if closer)
        var direction = normalizeDirection(this.optimalDirection + this.wobble(this.pursuitWobble));
        if (this !== game.player) {
          speed *= (1 + rand() + (1 - pow(min(1, distSquared / game.pursuitThresholdSquared), 2))) / 4;
        }
        this.move(direction, speed);
      }
    },
    patrol: function() {
      // random direction within patrolWobble of previous direction
      var direction = normalizeDirection(this.direction + this.wobble(this.patrolWobble));
      if (this.target) {
        // do a slight correction towards target if more than 90deg off
        var difference = normalizeDirection(this.optimalDirection - direction);
        if (abs(difference) > HALF_PI)
          direction += (difference > 0 ? 1 : -1) * PI * this.game.config.patrolCorrection / 180;
      }
      this.move(direction, this.speed / 3);
    },
    rest: function(duration, required) {
      if (typeof duration === 'undefined') {
        this.restTime--;
        if (!this.restTime)
          this.restRequired = false;
      }
      else {
        this.restTime = duration;
        this.restRequired = required;
      }
    },
    move: function(direction, distance) {
      var frd = this.agents.bestMoveFor(this, direction, distance);
      if (frd) {
        this.direction = frd.direction;
        this.currentSpeed = frd.distance;
        this.set(frd.x, frd.y);
      }
    },
    set: function(x, y) {
      this.agents.set(this, x, y);
    },
    kill: function() {
      this.alive = false;
      this.decayTime = this.maxDecayTime;
    },
    maim: function(time) {
      this.sleepTime = floor(time);
    },
    stun: function(time) {
      this.rest(time, true);
    },
    projectedLocation: function(time) {
      var ticks = time / this.game.tickTime,
          projectedDist = this.currentSpeed * ticks,
          direction = this.direction,
          x = this.x + projectedDist * cos(direction),
          y = this.y + projectedDist * sin(direction);
      return {x: x, y: y};
    }
  };

  function Zombie(game, target){
    Tracker.call(this, game, target);
    this.speed = (0.5 * (1 + rand()) * this.maxSpeed);
    this.speedSquared = this.speed * this.speed;
    this.sprite = 1 + floor(rand() * 15);
    this.predictFactor = rand() * rand();
  }
  Zombie.prototype = new Tracker;
  Zombie.prototype.maxSpeed = 6;
  Zombie.prototype.zombie = true;

  function MouseTarget(board) {
    this.board = board;
    this.x = board.width / 2;
    this.y = board.height / 2;
    this.mask = document.createElement('canvas');
    this.maskContext = this.mask.getContext('2d');
  }
  MouseTarget.prototype = {
    caughtBy: function(){},
    trackable: true,
    size: 0,
    set: function(x, y) {
      this.x = x;
      this.y = y;
    },
    render: function(board) {
      var context = board.context,
          canvas = board.canvas,
          width = canvas.width,
          height = canvas.height,
          radius = min(width, height) / 5,
          eyeOffset = 0.7,
          gradient,
          x = this.x,
          y = this.y / 2,
          mask = this.mask,
          maskContext = this.maskContext;
      mask.width = width;
      mask.height = height;
      maskContext.clearRect(0, 0, width, height);
      gradient = maskContext.createRadialGradient(x - eyeOffset * radius, y, radius * 0.9, x - eyeOffset * radius, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      maskContext.fillStyle = gradient;
      maskContext.arc(x - eyeOffset * radius, y, radius, 0, TAU);
      maskContext.fill();
      gradient = maskContext.createRadialGradient(x + eyeOffset * radius, y, radius * 0.9, x + eyeOffset * radius, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      maskContext.fillStyle = gradient;
      maskContext.arc(x + eyeOffset * radius, y, radius, 0, TAU);
      maskContext.fill();
      maskContext.globalCompositeOperation = 'xor';
      maskContext.fillStyle = 'rgba(0,0,0,1)';
      maskContext.fillRect(0, 0, width, height);
      context.drawImage(mask, 0, 0);
    }
  };

  function Player(game, mouseTarget) {
    Tracker.call(this, game, mouseTarget);
    this.set(mouseTarget.x, mouseTarget.y);
    this.speedSquared = this.speed * this.speed;
    this.directionKeysPressed = {};
    this.weapons = [];
    var weaponNames = game.config.weapons;
    for (var i = 0; i < weaponNames.length; i++) {
      this.weapons.push(Weapon.factory(weaponNames[i], game, this));
    }
    this.weapon = this.weapons[0];
  }
  Player.prototype = new Tracker;
  $.extend(Player.prototype, {
    pursuitWobble: 0,
    speed: 12,
    direction: 0,
    sprite: 0,
    checkProximity: function() {
      Tracker.prototype.checkProximity.call(this);
    },
    targetVisible: function() {
      return true;
    },
    kill: function() {
      Tracker.prototype.kill.call(this);
      this.weapon.ready = false;
      this.game.gameOver();
    },
    infect: function() {
      this.kill();
      this.decayTime = 0;
      var zombie = new Zombie(this.game);
      zombie.sprite = 0;
      zombie.direction = 0;
      zombie.set(this.x, this.y + 1); // js sort isn't stable, so we want the zombie consistently in the front during rest
      zombie.sleepTime = 40;
      this.agents.push(zombie);
    },
    caughtBy: function() {
      this.infect();
    },
    directionKeys: {
      37: 'W', // left
      38: 'N', // up
      39: 'E', // right
      40: 'S', // down
      65: 'W', // A
      87: 'N', // W
      68: 'E', // D
      83: 'S'  // S
    },
    inferManualDirection: function() {
      var directions = {};
      for (key in this.directionKeysPressed) {
        if (this.directionKeysPressed[key])
          directions[this.directionKeys[key]] = true;
      }
      this.manualX = directions.E ^ directions.W ? (directions.E ? 1 : -1) : 0;
      this.manualY = directions.S ^ directions.N ? (directions.S ? 1 : -1) : 0;
    },
    mouseDown: function() {
      if (this.alive && this.weapon.ready && !this.sleepTime)
        this.weapon.fire();
    },
    mouseUp: function() {
      if (this.alive && this.weapon.firing && !this.sleepTime)
        this.weapon.fired();
    },
    mouseMove: function() {
      if (this.manual && !this.manualX && !this.manualY)
        this.manual = false;
    },
    keyDown: function(key) {
      if (!this.alive) return;
      if (this.directionKeys[key]) {
        this.manual = true;
        this.directionKeysPressed[key] = true;
        this.inferManualDirection();
      }
      else if (this.weapon.ready && !this.sleepTime) {
        if (key === 32)
          this.weapon.fire();
        else if (key === 188)
          this.prevWeapon();
        else if (key === 190)
          this.nextWeapon();
      }
    },
    keyUp: function(key) {
      if (!this.alive) return;
      if (this.directionKeys[key]) {
        this.directionKeysPressed[key] = false;
        this.inferManualDirection();
      }
      else if (key === 32 && this.weapon.firing) {
        this.weapon.fired();
      }
    },
    nextMove: function() {
      var ret = Tracker.prototype.nextMove.call(this);
      this.weapon.nextMove();
      return ret;
    },
    prevWeapon: function() {
      this.weapons.unshift(this.weapons.pop());
      this.weapon = this.weapons[0];
    },
    nextWeapon: function() {
      this.weapons.push(this.weapons.shift());
      this.weapon = this.weapons[0];
    }
  });

  window.Zomgbie = Zomgbie;
})($);

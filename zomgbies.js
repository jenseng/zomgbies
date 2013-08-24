(function($) {

  var sectorSize = 48;
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
  var min = Math.min;
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

  function distance(a, b) {
    return hypotenuse(b.x - a.x, b.y - a.y);
  }

  function sectorCoord(n) {
    return floor(n / sectorSize);
  }

  function sector() {
    return sectorCoord(this.x) + ":" + sectorCoord(this.y);
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
    if (this.config.mode == 'observe') {
      this.config.patrolCorrection = 1;
      this.config.pursueTargets = false;
      this.addAllZombies();
    } else {
      this.stats = new Stats(this);
      this.player = new Player(this, this.mouseTarget);
      this.agents.push(this.player);
    }
    this.addListeners($canvas);

    this.pursuitThreshold = this.config.pursuitThreshold;
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

      if (this.player) {
        $doc.on('keydown', this.player.keyDown.bind(this.player));
        $doc.on('keyup', this.player.keyUp.bind(this.player));
      }

      if (this.config.resize) {
        var $window = $(window);
        $window.on('resize', this.board.resize.bind(this.board));
      }
    },
    times: {tick: [], run: [], render: []},
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
        this.pursuitThreshold -= 2;
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
    noise: function() {
      this.pursuitThreshold = min(this.pursuitThreshold + this.config.pursuitThreshold, 6 * this.config.pursuitThreshold);
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
      if (player && !player.dead)
        this.renderRadius();
      for (var i = 0; i < len; i++) {
        if (args[i].render) {
          args[i].render(this);
        } else {
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
      } else {
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
        x = alignment == 'left' ? 10 : board.canvas.width - 10;
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
      else if (xAlign == 'right')
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
        } else {
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
      context.fillStyle = player.dead ? '#333' : '#800';
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
        return a.dist - b.dist;
      });
      byStacking.sort(function(a, b) {
        return a.y - b.y;
      });
      this.sectors = {};
      for (i = 0; i < len; i++) {
        this.addToSector(byDistance[i]);
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
      this.removeFromSector(agent);
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
            } else {
              agent.deviations = 0;
            }
            return {
              distance: currDist,
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
    closestCollision: function(agent) {
      var neighbors = this.neighbors(agent),
          len = neighbors.length,
          collision,
          closest;
      for (var i = 0; i < len; i++) {
        collision = agent.checkCollision(neighbors[i], agent.x, agent.y);
        if (collision && (!closest || collision.dist < closest.dist))
          closest = collision;
      }
      return closest;
    },
    validMoveFor: function(agent, direction, distance) {
      var x = agent.x + distance * cos(direction),
          y = agent.y + distance * sin(direction),
          sectorX = sectorCoord(x),
          sectorY = sectorCoord(y),
          neighbors,
          len;
      if (agent !== this.game.player) {
        neighbors = this.neighborsFor(sectorX, sectorY, agent);
        len = neighbors.length;
        for (var i = 0; i < len; i++) {
          if (agent.checkCollision(neighbors[i], x, y))
            return false;
        }
      }
      return {x: x, y: y};
    },
    neighbors: function(agent, distance) {
      return this.neighborsFor(sectorCoord(agent.x), sectorCoord(agent.y), agent, distance);
    },
    neighborsFor: function(x, y, agent, distance) {
      distance = distance === null || typeof distance === 'undefined' ? 1 : ceil(distance / sectorSize);
      var neighbors = [],
          sector,
          len;
      for (var i = -distance; i <= distance; i++) {
        for (var j = -distance; j <= distance; j++) {
          sector = this.sectors[(x + i) + ":" + (y + j)];
          if (!sector) continue;
          len = sector.length;
          for (var n = 0; n < len; n++) {
            if (sector[n] === agent || sector[n] === agent.target || sector[n].dead || sector[n].object) continue;
            neighbors.push(sector[n]);
          }
        }
      }
      return neighbors;
    },
    set: function(agent, x, y) {
      var sKeyOld = agent.sector(),
          sKey;
      agent.x = x;
      agent.y = y;
      sKey = agent.sector();
      if (sKey !== sKeyOld)
        this.removeFromSector(agent, sKeyOld);
      this.addToSector(agent, sKey);
    },
    addToSector: function(agent, sKey) {
      if (typeof sKey === 'undefined')
        sKey = agent.sector();
      var sector = this.sectors[sKey] || (this.sectors[sKey] = []);
      sector.push(agent);
    },
    removeFromSector: function(agent, sKey) {
      if (typeof sKey === 'undefined')
        sKey = agent.sector();
      var sector = this.sectors[sKey];
      if (sector)
        sector.splice(sector.indexOf(agent), 1);
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
        } else if (!agent.dead && agent.zombie) {
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
        if (!this.player.dead)
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
        if (agent.dead || !agent.zombie)
          continue;
        closest = agent;
        break;
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
    killZone: 100,
    stunZone: 200,
    speed: 64,
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
      this.x = player.x;
      this.y = player.y;
      this.z = 64; // shoulder height
      this.game.agents.push(this);

      if (target) {
        var time = (this.timeToExplode + this.pulledPin - new Date().getTime());
        var orig = target;
        target = target.projectedLocation(this.timeToExplode + this.pulledPin - new Date().getTime());
        var distX = target.x - this.x;
        var distY = target.y - this.y;
        var dist = hypotenuse(distX, distY);
        optimalSpeed = sqrt(dist * this.gravityPerTick) * 0.9; // fudge factor due to drop and roll
        this.direction = atan2(distY, distX);
      } else { // no target, just throw it far
        optimalSpeed = this.speed;
        this.direction = normalizeDirection(rand() * TAU);
      }
      optimalSpeedSide = optimalSpeed / sqrt(2); // get the v/h speed (same, since 45 deg is optimal)
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
    explode: function() {
      var agents = this.game.agents;

      // TODO explode sound
      if (!this.thrown) { // oh crap, didn't throw it!
        var player = this.player;
        this.thrown = true;
        this.x = player.x;
        this.y = player.y;
        this.z = 0;
        agents.push(this);
      }
      this.speed = 0;
      this.zSpeed = 0;
      var neighbors = agents.neighbors(this, this.stunZone),
          neighbor,
          dist,
          hitCount = 0;

      for (var i = 0; i < neighbors.length; i++) {
        neighbor = neighbors[i];
        dist = distance(this, neighbor);
        if (dist < this.killZone) {
          hitCount++;
          neighbor.kill();
        }
        else if (dist < this.stunZone)
          neighbor.stun(80 * (1 - dist / this.stunZone));
      }
      if (hitCount === 0)
        read(pick("waste", "total waste", "got nothin", "next time", "do you even aim bro?"));
      else
        read(pick("hahaha", "awesome, " + hitCount, "got " + hitCount, "haha, you blew up " + hitCount, "ha, got " + hitCount, "that'll teach them", "it's raining arms", "i love grenades"));
      this.exploded = true;
      this.explodeTime = 15;
    },
    nextMove: function() {
      if (this.speed > 0) {
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
        this.x += this.speed * cos(this.direction);
        this.y += this.speed * sin(this.direction);
      }
      if (this.explodeTime) this.explodeTime--;
      return !this.exploded || this.explodeTime;
    },
    render: function(board) {
      var context = board.context;
      if (this.exploded) {
        context.save();
        var fade = this.explodeTime < 12 ? this.explodeTime / 12 : 1;
        fade = fade*fade*fade;
        context.globalAlpha = fade;
        var size = this.explodeTime > 13 ?
          5 * (16 - this.explodeTime):
          10 + this.explodeTime / 2;
        var circles = size * 2;
        for (var i = 0; i < circles; i++) {
          context.beginPath();
          var rad = (1 + 4 * rand()) * size;
          var x = (5 - 10 * rand()) * size;
          var y = (1 - 4 * rand()) * size;
          y -= (1 - this.explodeTime / 15) * 200;
          context.arc(this.x + x, this.y / 2 - this.z + y, rad, 0, TAU);
          var gray = (1 - fade) * (96 + rand() * 128);
          var r = floor(gray + fade * 255);
          var g = floor(gray + fade * (192 + rand() * 64));
          var b = floor(gray + fade * (rand() * 128));
          context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',1)';
          context.fill();
          context.strokeStyle = 'rgba(' + floor(r*0.9) + ',' + floor(g*0.9) + ',' + floor(b*0.9) + ',1)';
          context.stroke();
        }
        context.restore();
      } else {
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
    sector: sector
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
      } else {
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
        direction = atan2(closest.distY, closest.distX);
        direction += PI * (rand() / 45 - 1 / 90); // off by up to 3 degrees
        for (var i = 0; i < len; i++) {
          agent = byDistance[i];
          if (agent === player || agent.dead)
            continue;
          // will the shot hit this zombie?
          hitMargin = abs(atan2(agent.size / 4, agent.dist));
          offBy =  abs(atan2(agent.distY, agent.distX) - direction);
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
      if (this.dead && !decayTime)
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
    sector: sector,
    nextMove: function() {
      this.currentSpeed = 0;
      if (this.dead) {
        if (this.decayTime)
          this.decayTime--;
        return this.decayTime; // if zero, time to remove it
      }

      this.checkProximity();

      if (this.sleepTime)
        this.sleepTime--;
      else if (this.manual && !this.restRequired)
        this.manualMove();
      else if (this.game.config.pursueTargets && (this.targetVisible || this.targetTrackTime) && !this.restRequired)
        this.pursue();
      else if (this.restTime)
        this.rest();
      else if (rand() < 0.02)
        this.rest(ceil(rand() * 40));
      else
        this.patrol();
      return true;
    },
    checkCollision: function(other, newX, newY) {
      var distX = abs(other.x - newX),
          distY = abs(other.y - newY),
          minDist = (this.size + other.size) / 2;
      if (distX > minDist || distY > minDist || hypotenuse(distX, distY) > minDist)
        return false;
      else
        return {direction: atan2(distY, distX)};
    },
    checkProximity: function() {
      var target = this.target;
      this.targetVisible = false;
      if (target && !target.dead) {
        var x = this.x,
            y = this.y,
            distX = this.distX = target.x - x,
            distY = this.distY = target.y - y,
            dist = this.dist = hypotenuse(this.distX, this.distY),
            optimalDirection = this.optimalDirection = atan2(this.distY, this.distX);
        if (this.predictFactor && target.currentSpeed) {
          var correction;
          // target fleeing?
          if (abs(normalizeDirection(this.optimalDirection - target.direction)) < HALF_PI) {
            var projected = target.projectedLocation(500);
            correction = this.predictFactor * normalizeDirection(atan2(projected.y - y, projected.x - x) - optimalDirection);
          } else { // try to intercept (not perfect, since speeds don't match, but zombies aren't *that* smart)
            correction = this.predictFactor * normalizeDirection(PI - (target.direction - optimalDirection));
          }
          this.optimalDirection = normalizeDirection(optimalDirection + correction);
        }
        this.targetVisible = dist < this.game.pursuitThreshold;
      } else {
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
          dist = this.dist,
          speed = this.speed,
          game = this.game;
      if (dist - (this.size + target.size) / 2 < speed) { // jump to target
        if (dist < speed) {
          this.set(target.x, target.y);
        } else {
          this.move(this.optimalDirection, speed);
        }
        target.caughtBy(this);
        this.restTime = 20;
      }
      else {
        // pursue with a slight wobble and variable speed (faster if closer)
        var direction = normalizeDirection(this.optimalDirection + this.wobble(this.pursuitWobble));
        if (this !== game.player) {
          speed *= (1 + rand() + (1 - pow(min(1, dist / game.pursuitThreshold), 3))) / 4;
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
      if (typeof duration == 'undefined') {
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
      this.dead = true;
      this.decayTime = this.maxDecayTime;
    },
    stun: function(time) {
      this.sleepTime = floor(time);
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
      mask.width = canvasWidth;
      mask.height = canvasHeight;
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
    this.set(this.target.x, this.target.y);
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
      this.targetVisible = true;
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
      if (!this.dead && this.weapon.ready)
        this.weapon.fire();
    },
    mouseUp: function() {
      if (!this.dead && this.weapon.firing)
        this.weapon.fired();
    },
    mouseMove: function() {
      if (this.manual && !this.manualX && !this.manualY)
        this.manual = false;
    },
    keyDown: function(e) {
      var key = e.which;
      if (this.dead) return;
      if (this.directionKeys[key]) {
        this.manual = true;
        this.directionKeysPressed[key] = true;
        this.inferManualDirection();
      } else if (this.weapon.ready) {
        if (e.which === 32)
          this.weapon.fire();
        else if (e.which === 188)
          this.prevWeapon();
        else if (e.which === 190)
          this.nextWeapon();
      }
    },
    keyUp: function(e) {
      var key = e.which;
      if (this.dead) return;
      if (this.directionKeys[key]) {
        this.directionKeysPressed[key] = false;
        this.inferManualDirection();
      } else if (e.which === 32 && this.weapon.firing) {
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

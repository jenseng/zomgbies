(function($) {

  var sectorSize = 48;
  var pixelsPerMeter = 36;
  var gravity = 9.8 * pixelsPerMeter;

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
    return arguments[Math.floor(Math.random() * arguments.length)];
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
    setTimeout(makeObservation, 5000 + 1000 * Math.floor(Math.random() * 20));
  }
  setTimeout(makeObservation, 10000);

  function normalizeDirection(direction) {
    if (direction > Math.PI)
      direction -= 2 * Math.PI;
    else if (direction < -Math.PI)
      direction += 2 * Math.PI;
    return direction;
  }

  function hypotenuse(a, b) {
    return Math.sqrt(a * a + b * b);
  }

  function distance(a, b) {
    return hypotenuse(b.x - a.x, b.y - a.y);
  }

  function sectorCoord(n) {
    return Math.floor(n / sectorSize);
  }

  function sector() {
    return sectorCoord(this.x) + ":" + sectorCoord(this.y);
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
    this.tickTime = Math.floor(1000 / this.config.ticksPerSecond);
  };
  Game.prototype = {
    config: {
      ticksPerSecond: 30,
      maxZombies: 100,
      maxSpawnsPerTick: 5,
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
    run: function() {
      this.maybeAddZombies();
      this.agents.move();

      this.agents.sort();
      if (this.player)
        this.board.render(this.agents, this.player.weapons, this.stats);
      else
        this.board.render(this.agents, this.mouseTarget);
      if (this.pursuitThreshold > this.config.pursuitThreshold)
        this.pursuitThreshold -= 2;
      setTimeout(this.run.bind(this), this.tickTime);
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
          numZombies;
      if (this.agents.numZombies < this.config.maxZombies && Math.random() * 80 < 1) {
        numZombies = Math.min(Math.ceil(Math.random() * this.config.maxSpawnsPerTick), this.config.maxZombies - this.agents.numZombies);
        if (Math.random() < 0.2) {
          if (numZombies === 1)
            read(this.agents.numZombies === 0 ? "zombie" : pick("another zombie", "yet another", "zombie", "walker"));
          else if (numZombies < 4)
            read(pick("zombies", "here they come", "here come a couple", "yikes"));
          else
            read(pick("uh oh", "damn", "oh no", "damn", "oh crap a lot of zombies", "here comes the horde", "whoa that's a lot", "they just keep coming"));
        }
        for (var i = 0; i < numZombies; i++) {
          zombie = new Zombie(this, this.player);
          zombie.randomEdgeStart(this.board);
          this.agents.push(zombie);
        }
      }
    },
    gameOver: function() {
      var messages = this.config.messages.gameOver;
      var message = pick.apply(window, messages);
      read("game over. " + message);
      read = function(){};
      this.stats.setStatus(message);
    },
    noise: function() {
      this.pursuitThreshold = Math.min(this.pursuitThreshold + this.config.pursuitThreshold, 6 * this.config.pursuitThreshold);
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
      var context = this.context;
      context.save();
      context.scale(1, 0.5);
      context.globalAlpha = 0.25;
      context.beginPath();
      // TODO should y really use size?
      context.arc(this.game.player.x, this.game.player.y - this.game.player.size, this.game.pursuitThreshold, 0, 2 * Math.PI);
      context.fillStyle = '#ffd';
      context.fill();
      context.restore();
    },
    render: function() {
      this.context.clearRect(0, 0, this.width, this.height);
      var args = [].slice.call(arguments);
      if (this.game.player && !this.game.player.dead)
        this.renderRadius();
      for (var i = 0; i < args.length; i++) {
        if (args[i].render) {
          args[i].render(this);
        } else {
          for (var j = 0; j < args[i].length; j++) {
            args[i][j].render(this);
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
          sectorAgents = 0;
      for (var sector in sectors) {
        sectorCount++;
        sectorAgents += sectors[sector].length;
      }
      this.renderText(
        board,
        "sectors: " + sectorCount +
        "\nagents: " + sectorAgents,
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
        context.globalAlpha = 0.6 * Math.min(1, 4 * this.statusTime / this.maxStatusTime);
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
      this.byDistance.sort(function(a, b) {
        return a.dist - b.dist;
      });
      this.byStacking.sort(function(a, b) {
        return a.y - b.y;
      });
      this.sectors = {};
      for (var i = 0; i < this.length; i++) {
        var agent = this.byDistance[i];
        this.addToSector(agent);
        this.byDistance[i].distanceIdx = i;
        this.byStacking[i].stackingIdx = i;
      }
    },
    numZombies: 0,
    remove: function(agent) {
      var i;
      this.length--;
      this.byDistance.splice(agent.distanceIdx, 1);
      for (i = agent.distanceIdx; i < this.length; i++)
        this.byDistance[i].distanceIdx--;
      this.byStacking.splice(agent.stackingIdx, 1);
      for (i = agent.stackingIdx; i < this.length; i++)
        this.byStacking[i].stackingIdx--;
      this.removeFromSector(agent);
    },
    bestMoveFor: function(agent, direction, distance) {
      var currDir,
          currDist,
          currMove,
          collision,
          factor = Math.random() > 0.5 ? 1 : -1; // so we alternate between left/right
      // try 7 directions at 4 decreasing speeds, starting w/ desired vector
      for (var i = 0; i < 4; i++) {
        currDist = (4 - i) / 4 * distance;
        for (var j = 0; j < 7; j++) {
          // 0 / 45 / -45 / 90 / - 90
          currDir = normalizeDirection(direction + factor * (j % 2 === 0 ? 1 : -1) * Math.round(j / 2 + 0.25) * Math.PI / 4);
          currMove = this.validMoveFor(agent, currDir, currDist);
          if (currMove) {
            if (i > 0 || j > 0) {
              if (agent.deviations > 2) { // don't want to ping pong forever, take a breather
                agent.rest(Math.floor(Math.random() * 20), true);
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
        currDir = normalizeDirection(Math.PI + collision.direction);
        return {
          distance: distance,
          direction: currDir,
          x: agent.x + 0.5 * distance * Math.cos(currDir),
          y: agent.y + 0.5 * distance * Math.sin(currDir)
        };
      }
      // we're surrounded but not overlapping, wait a tick for neighbors to leave
      return null;
    },
    closestCollision: function(agent) {
      var neighbors = this.neighbors(agent),
          collision,
          closest;
      for (var i = 0; i < neighbors.length; i++) {
        collision = agent.checkCollision(neighbors[i], agent.x, agent.y);
        if (collision && (!closest || collision.dist < closest.dist))
          closest = collision;
      }
      return closest;
    },
    validMoveFor: function(agent, direction, distance) {
      var x = agent.x + distance * Math.cos(direction),
          y = agent.y + distance * Math.sin(direction),
          sectorX = sectorCoord(x),
          sectorY = sectorCoord(y);
      if (agent !== this.game.player) {
        var neighbors = this.neighborsFor(sectorX, sectorY, agent);
        for (var i = 0; i < neighbors.length; i++) {
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
      distance = distance === null || typeof distance === 'undefined' ? 1 : Math.ceil(distance / sectorSize);
      var neighbors = [],
          sector;
      for (var i = -distance; i <= distance; i++) {
        for (var j = -distance; j <= distance; j++) {
          sector = this.sectors[(x + i) + ":" + (y + j)];
          if (!sector) continue;
          for (var n = 0; n < sector.length; n++) {
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
      if (!this.sectors[sKey])
        this.sectors[sKey] = [];
      this.sectors[sKey].push(agent);
    },
    removeFromSector: function(agent, sKey) {
      if (typeof sKey === 'undefined')
        sKey = agent.sector();
      if (this.sectors[sKey]) {
        var idx = this.sectors[sKey].indexOf(agent);
        this.sectors[sKey].splice(idx, 1);
      }
    },
    move: function() {
      var agent,
          numZombies = 0;
      for (var i = 0; i < this.length; i++) {
        // closest ones get to move first
        agent = this.byDistance[i];
        if (!agent.nextMove()) {
          this.remove(agent);
          i--;
        } else if (!agent.dead && agent.zombie) {
          numZombies++;
        }
      }
      this.numZombies = numZombies;
    },
    render: function(board) {
      for (var i = 0; i < this.byStacking.length; i++) {
        this.byStacking[i].render(board);
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
          agent;
      for (var i = 0; i < agents.byDistance.length; i++) {
        agent = agents.byDistance[i];
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
          maxSpeed;

      this.thrown = true;
      this.x = this.player.x;
      this.y = this.player.y;
      this.z = 64; // shoulder height
      this.game.agents.push(this);

      if (target) {
        var time = (this.timeToExplode + this.pulledPin - new Date().getTime());
        var orig = target;
        target = target.projectedLocation(this.timeToExplode + this.pulledPin - new Date().getTime());
        var distX = target.x - this.x;
        var distY = target.y - this.y;
        var dist = hypotenuse(distX, distY);
        optimalSpeed = Math.sqrt(dist * this.gravityPerTick) * 0.9; // fudge factor due to drop and roll
        this.direction = Math.atan2(distY, distX);
      } else { // no target, just throw it far
        optimalSpeed = this.speed;
        this.direction = normalizeDirection(Math.random() * 2 * Math.PI);
      }
      optimalSpeedSide = optimalSpeed / Math.sqrt(2); // get the v/h speed (same, since 45 deg is optimal)
      inertia = this.player.currentSpeed * Math.cos(this.player.direction - this.direction);
      relativeOptimalSpeed = hypotenuse(optimalSpeedSide, optimalSpeedSide - inertia);
      maxSpeed = this.speed * (optimalSpeed / relativeOptimalSpeed);
      if (optimalSpeed > maxSpeed)
        optimalSpeedSide *= maxSpeed / optimalSpeed;
      this.zSpeed = optimalSpeedSide;
      this.speed = optimalSpeedSide;

      // TODO maybe if close enough, bean zombie in head?
      // TODO throw sound
      if (Math.random() < 0.25)
        read(pick("nice throw", "good arm", "good throw", "nice", "you're nolan ryan"));
    },
    explode: function() {
      // TODO explode sound
      if (!this.thrown) { // oh crap, didn't throw it!
        this.thrown = true;
        this.x = this.player.x;
        this.y = this.player.y;
        this.z = 0;
        this.game.agents.push(this);
      }
      this.speed = 0;
      this.zSpeed = 0;
      var neighbors = this.game.agents.neighbors(this, this.stunZone),
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
        read(pick("waste", "total waste", "got nothin", "next time", "do you even aim bro?"))
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
        this.x += this.speed * Math.cos(this.direction);
        this.y += this.speed * Math.sin(this.direction);
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
          var rad = (1 + 4 * Math.random()) * size;
          var x = (5 - 10 * Math.random()) * size;
          var y = (1 - 4 * Math.random()) * size;
          y -= (1 - this.explodeTime / 15) * 200;
          context.arc(this.x + x, this.y / 2 - this.z + y, rad, 0, 2 * Math.PI);
          var gray = (1 - fade) * (96 + Math.random() * 128);
          var r = Math.floor(gray + fade * 255);
          var g = Math.floor(gray + fade * (192 + Math.random() * 64));
          var b = Math.floor(gray + fade * (Math.random() * 128));
          context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',1)';
          context.fill();
          context.strokeStyle = 'rgba(' + Math.floor(r*0.9) + ',' + Math.floor(g*0.9) + ',' + Math.floor(b*0.9) + ',1)';
          context.stroke();
        }
        context.restore();
      } else {
        context.beginPath();
        context.arc(this.x, this.y / 2 - this.z, 3, 0, 2 * Math.PI);
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
      var wait = this.grenade.timeToThrow();
      if (wait > 0) {
        setTimeout(this.fired.bind(this), wait);
      } else {
        this.grenade.throwAt(this.closest());
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
          direction = Math.random() * Math.PI * 2,
          player = this.player,
          agents = this.game.agents,
          agent,
          hitMargin,
          offBy,
          hitCount = 0,
          sound;

      this.game.noise();

      if (closest) {
        direction = Math.atan2(closest.distY, closest.distX);
        direction += Math.PI * (Math.random() / 45 - 1 / 90); // off by up to 3 degrees
        for (var i = 0; i < agents.byDistance.length; i++) {
          agent = agents.byDistance[i];
          if (agent === player || agent.dead)
            continue;
          // will the shot hit this zombie?
          hitMargin = Math.abs(Math.atan2(agent.size / 4, agent.dist));
          offBy =  Math.abs(Math.atan2(agent.distY, agent.distX) - direction);
          if (offBy < hitMargin) {
            hitCount++;
            agent.kill();
          }
        }
      }
      this.game.stats.addShotInfo(hitCount);
      direction = normalizeDirection(direction + Math.PI);
      this.lastShot = {x: player.x, y: player.y, direction: direction, visibleTime: this.maxVisibleTime};
      this.shots--;
      read(hitCount === 0 ? pick("miss", "whiff", "so close", "next time") : hitCount === 1 ? pick("nice shot", "got one", "got 'em", "haha", "headshot") : pick("oh wow", "got " + hitCount, "mega kill", hitCount + " for 1", "haha, amazing"));
      this.sounds.fire.load();
      this.sounds.fire.play();
      this.disable(800, function() {
        if (!this.shots)
          this.reload();
      });
    },
    reload: function() {
      read(pick("reload quick", "quick", "hurry", "c'mon", "let's go", "faster", "oh man"));
      this.sounds.reload.load();
      this.sounds.reload.play();
      this.disable(3000, function() {
        this.shots = 6;
      });
    },
    render: function(board) {
      var context = board.context;
      if (this.lastShot && this.lastShot.visibleTime) {
        context.save();
        context.beginPath();
        context.moveTo(this.lastShot.x, this.lastShot.y / 2 - 40); // shot fired from 5/9 up player
        context.lineTo(this.lastShot.x + 600 * Math.cos(this.lastShot.direction), (this.lastShot.y + 600 * Math.sin(this.lastShot.direction)) / 2 - 56); // end of stroke is 7/9 up (through head of zombies)
        context.strokeStyle = '#ccc';
        context.globalAlpha = this.lastShot.visibleTime / this.maxVisibleTime;
        context.stroke();
        context.restore();
        this.lastShot.visibleTime--;
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
      this.direction = normalizeDirection(Math.random() * Math.PI * 2);
      this.set(Math.random() * board.width, Math.random() * board.height);
    },
    randomEdgeStart: function(board) {
      var sprite = this.game.config.sprites[this.sprite],
          startPos = Math.random() * 2 * (board.width + board.height);
      if (startPos < board.width) {
        this.direction = Math.PI / 2;
        this.set(startPos, 0);
      }
      else if (startPos < board.width + board.height) {
        this.direction = Math.PI;
        this.set(board.width + sprite.width / 2, startPos - board.width);
      }
      else if (startPos < 2 * board.width + board.height) {
        this.direction = 3 * Math.PI / 2;
        this.set(startPos - board.width - board.height, board.height + sprite.height * 2);
      }
      else {
        this.direction = 0;
        this.set(-sprite.width / 2, startPos - 2 * board.width - board.height);
      }
    },
    render: function(board) {
      var context = board.context,
          sprite = this.game.config.sprites[this.sprite];
      if (this.dead && !this.decayTime)
        return;
      if (this.decayTime || this.sleepTime) {
        context.save();
        if (this.decayTime)
          context.globalAlpha = this.decayTime > this.maxDecayTime / 2 ? 1 : 2 * this.decayTime / this.maxDecayTime;
        context.translate(Math.round(this.x), Math.round(this.y / 2));
        context.rotate(Math.PI / 2);
        context.drawImage(sprite, -sprite.width, -sprite.height / 2);
        context.restore();
      }
      else {
        context.drawImage(sprite, Math.round(this.x - sprite.width / 2), Math.round(this.y / 2 - sprite.height));
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
      else if (Math.random() < 0.02)
        this.rest(Math.ceil(Math.random() * 40));
      else
        this.patrol();
      return true;
    },
    checkCollision: function(other, newX, newY) {
      var distX = other.x - newX,
          distY = other.y - newY,
          dist = hypotenuse(distX, distY);
      if (dist > (this.size + other.size) / 2)
        return false;
      else
        return {direction: Math.atan2(distY, distX)};
    },
    checkProximity: function() {
      this.targetVisible = false;
      if (this.target && !this.target.dead) {
        this.distX = this.target.x - this.x;
        this.distY = this.target.y - this.y;
        this.dist = hypotenuse(this.distX, this.distY);
        this.optimalDirection = Math.atan2(this.distY, this.distX);
        if (this.predictFactor && this.target.currentSpeed) {
          var correction;
          // target fleeing?
          if (Math.abs(normalizeDirection(this.optimalDirection - this.target.direction)) < Math.PI / 2) {
            var projected = this.target.projectedLocation(500);
            correction = this.predictFactor * normalizeDirection(Math.atan2(projected.y - this.y, projected.x - this.x) - this.optimalDirection);
          } else { // try to intercept (not perfect, since speeds don't match, but zombies aren't *that* smart)
            correction = this.predictFactor * normalizeDirection(Math.PI - (this.target.direction - this.optimalDirection));
          }
          this.optimalDirection = normalizeDirection(this.optimalDirection + correction);
        }
        this.targetVisible = this.dist < this.game.pursuitThreshold;
      } else {
        this.targetTrackTime = 0;
      }
    },
    wobble: function(degrees) {
      if (!degrees) return 0;
      return Math.PI * (Math.random() * degrees / 90 - degrees / 180);
    },
    manualMove: function() {
      var direction = normalizeDirection(Math.atan2(this.manualY, this.manualX));
      if (this.manualX || this.manualY)
        this.move(direction, this.speed);
    },
    pursue: function() {
      // TODO: not quite right
      if (this.targetTrackTime)
        this.targetTrackTime--;
      else
        this.targetTrackTime = 120;
      if (this.dist - (this.size + this.target.size) / 2 < this.speed) { // jump to target
        if (this.dist < this.speed) {
          this.set(this.target.x, this.target.y);
        } else {
          this.move(this.optimalDirection, this.speed);
        }
        this.target.caughtBy(this);
        this.restTime = 20;
      }
      else {
        // pursue with a slight wobble and variable speed (faster if closer)
        var direction = normalizeDirection(this.optimalDirection + this.wobble(this.pursuitWobble));
        var speed = this.speed;
        if (this !== this.game.player) {
          speed *= (1 + Math.random() + (1 - Math.pow(Math.min(1, this.dist / this.game.pursuitThreshold), 3))) / 4;
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
        if (Math.abs(difference) > Math.PI / 2)
          direction += (difference > 0 ? 1 : -1) * Math.PI * this.game.config.patrolCorrection / 180;
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
      this.sleepTime = Math.floor(time);
    },
    projectedLocation: function(time) {
      var ticks = time / this.game.tickTime,
          x = this.x + this.currentSpeed * ticks * Math.cos(this.direction),
          y = this.y + this.currentSpeed * ticks * Math.sin(this.direction);
      return {x: x, y: y};
    }
  };

  function Zombie(game, target){
    Tracker.call(this, game, target);
    this.speed = (0.5 * (1 + Math.random()) * this.maxSpeed);
    this.sprite = 1 + Math.floor(Math.random() * 15);
    this.predictFactor = Math.random() * Math.random();
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
          radius = Math.min(board.canvas.width, board.canvas.height) / 5,
          eyeOffset = 0.7,
          gradient,
          x = this.x,
          y = this.y / 2;
      this.mask.width = board.canvas.width;
      this.mask.height = board.canvas.height;
      this.maskContext.clearRect(0, 0, this.mask.width, this.mask.height);
      gradient = this.maskContext.createRadialGradient(x - eyeOffset * radius, y, radius * 0.9, x - eyeOffset * radius, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.maskContext.fillStyle = gradient;
      this.maskContext.arc(x - eyeOffset * radius, y, radius, 0, 2 * Math.PI);
      this.maskContext.fill();
      gradient = this.maskContext.createRadialGradient(x + eyeOffset * radius, y, radius * 0.9, x + eyeOffset * radius, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.95)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      this.maskContext.fillStyle = gradient;
      this.maskContext.arc(x + eyeOffset * radius, y, radius, 0, 2 * Math.PI);
      this.maskContext.fill();
      this.maskContext.globalCompositeOperation = 'xor';
      this.maskContext.fillStyle = 'rgba(0,0,0,1)';
      this.maskContext.fillRect(0, 0, this.mask.width, this.mask.height);
      context.drawImage(this.mask, 0, 0);
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
    },
  });

  window.Zomgbie = Zomgbie;
})($);

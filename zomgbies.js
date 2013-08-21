(function($) {

  var sectorSize = 48;

  function normalizeDirection(direction) {
    if (direction > Math.PI)
      direction -= 2 * Math.PI;
    else if (direction < -Math.PI)
      direction += 2 * Math.PI;
    return direction;
  }

  function sectorCoord(n) {
    return parseInt(n / sectorSize, 10);
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
  };
  Game.prototype = {
    config: {
      maxZombies: 100,
      maxSpawnsPerTick: 100,
      pursuitThreshold: 200,
      patrolCorrection: 3,
      pursueTargets: true,
      mode: 'play',
      weapons: ['colt'] // sword | grenade
    },
    addListeners: function() {
      var $doc = $(document);

      this.$canvas.on('mousemove', function(e) {
        this.mouseTarget.x = e.clientX + 20;
        this.mouseTarget.y = e.clientY * 2 + 160;
        if (this.player)
          this.player.mouseMove();
      }.bind(this));

      this.$canvas.on('click', function(e) {
        this.mouseTarget.x = e.clientX + 20;
        this.mouseTarget.y = e.clientY * 2 + 160;
        if (this.player && this.player.weapon.ready)
          this.player.fire();
      }.bind(this));

      if (this.player) {
        $doc.on('keydown', this.player.keyDown.bind(this.player));
        $doc.on('keyup', this.player.keyUp.bind(this.player));
        $doc.on('keypress', this.player.keyPress.bind(this.player));
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
      setTimeout(this.run.bind(this), 33);
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
        for (var i = 0; i < numZombies; i++) {
          zombie = new Zombie(this, this.player);
          zombie.randomEdgeStart(this.board);
          this.agents.push(zombie);
        }
      }
    },
    gameOver: function() {
      var zombie = new Zombie(this);
      window.zombie = zombie;
      zombie.sprite = 0;
      zombie.direction = 0;
      zombie.set(this.player.x, this.player.y + 1); // js sort isn't stable, so we want the zombie consistently in the front during rest
      zombie.sleepTime = 40;
      this.agents.push(zombie);
      var messages = this.config.messages.gameOver;
      this.stats.setStatus(messages[parseInt(messages.length * Math.random(), 10)]);
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
      this.renderText(board, "walkers: " + this.game.agents.numZombies + "\nshots: " + (player.weapon.shots ? player.weapon.shots : "...") + (player.weapon.cache ? " / " + player.weapon.cache : ""), 30, "right", "bottom");
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
      for (var i = 0; i < 1; i++) {
        currDist = (4 - i) / 4 * distance;
        for (var j = 0; j < 7; j++) {
          // 0 / 45 / -45 / 90 / - 90
          currDir = normalizeDirection(direction + factor * (j % 2 === 0 ? 1 : -1) * Math.round(j / 2 + 0.25) * Math.PI / 4);
          currMove = this.validMoveFor(agent, currDir, currDist);
          if (currMove) {
            if (i > 0 || j > 0) {
              if (agent.deviations > 2) { // don't want to ping pong forever, take a breather
                agent.rest(parseInt(Math.random() * 20, 10), true);
                break;
              }
              agent.deviations++;
            } else {
              agent.deviations = 0;
            }
            return {direction: currDir, x: currMove.x, y: currMove.y};
          }
        }
      }
      // then see if we already overlap (due to spawn/bug/whatever), and if so, flee nearest neighbor at 1/2 impulse (overlap be damned)
      collision = this.closestCollision(agent);
      if (collision) {
        currDir = normalizeDirection(Math.PI + collision.direction);
        return {
          direction: currDir,
          x: agent.x + 0.5 * distance * Math.cos(currDir),
          y: agent.y + 0.5 * distance * Math.sin(currDir)
        };
      }
      // we're surrounded but not overlapping, wait a tick for neighbors to leave
      return null;
    },
    closestCollision: function(agent) {
      var neighbors = this.neighborsFor(sectorCoord(agent.x), sectorCoord(agent.y), agent),
          collision,
          closest;
      for (var i = 0; i < neighbors.length; i++) {
        collision = agent.checkCollision(neighbors[i], agent.x, agent.y);
        if (collision && (!closest || collision.dist < closest.dist))
          closest = collision;
      }
      return collision;
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
    neighborsFor: function(x, y, agent) {
      var neighbors = [],
          sector;
      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          sector = this.sectors[(x + i) + ":" + (y + j)];
          if (!sector) continue;
          for (var n = 0; n < sector.length; n++) {
            if (sector[n] === agent || sector[n] === this.game.player || sector[n].dead) continue;
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
        } else if (!agent.dead && agent !== this.game.player) {
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
      'grenade': Grenade
    }[name];
    return new constructor(game, player);
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
          agents = this.game.agents;
      for (var i = 0; i < agents.byDistance.length; i++) {
        agent = agents.byDistance[i];
        if (agent === this.player || agent.dead)
          continue;
        closest = agent;
        break;
      }
      return closest;
    }
  };

  function Grenade(game, player) {
    Weapon.call(this, game, player);
  }
  Grenade.prototype = new Weapon;
  $.extend(Grenade.prototype, {
    fire: function() {
    },
    render: function(board) {
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
            agent.headshot();
          }
        }
      }
      this.game.stats.addShotInfo(hitCount);
      direction = normalizeDirection(direction + Math.PI);
      this.lastShot = {x: player.x, y: player.y, direction: direction, visibleTime: this.maxVisibleTime};
      this.shots--;
      this.sounds.fire.load();
      this.sounds.fire.play();
      this.disable(800, function() {
        if (!this.shots)
          this.reload();
      });
    },
    reload: function() {
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
    maxDecayTime: 80,
    deviations: 0,
    randomStart: function(board) {
      this.direction = normalizeDirection(Math.random() * Math.PI * 2);
      this.set(Math.random() * board.width, Math.random() * board.height);
    },
    randomEdgeStart: function(board) {
      var sprite = this.game.config.sprites[this.sprite],
          startPos = Math.random() * 2 * (board.width + board.height);
      startPos = Math.random() * (board.width / 2);
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
    sector: function() {
      return sectorCoord(this.x) + ":" + sectorCoord(this.y);
    },
    nextMove: function() {
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
          dist = Math.sqrt(distX * distX + distY * distY);
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
        this.dist = Math.sqrt(this.distX * this.distX + this.distY * this.distY);
        this.optimalDirection = Math.atan2(this.distY, this.distX);
        if (this.predictFactor && this.target.moving) {
          var correction;
          // target fleeing?
          if (Math.abs(normalizeDirection(this.optimalDirection - this.target.direction)) < Math.PI / 2) {
            // see where they'll be in several ticks, and adjust
            var ticks = 10,
                predictX = this.distX + this.target.speed * ticks * Math.cos(this.target.direction),
                predictY = this.distY + this.target.speed * ticks * Math.sin(this.target.direction);
            correction = this.predictFactor * normalizeDirection(Math.atan2(predictY, predictX) - this.optimalDirection);
            //console.log("fleeing " + this.optimalDirection + " + " + correction);
          } else { // try to intercept (not perfect, since speeds don't match, but zombies aren't *that* smart)
            correction = this.predictFactor * normalizeDirection(Math.PI - (this.target.direction - this.optimalDirection));
            //console.log("intercept " + this.optimalDirection + " + " + correction);
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
        this.set(frd.x, frd.y);
      }
    },
    set: function(x, y) {
      this.agents.set(this, x, y);
    },
    headshot: function() {
      this.dead = true;
      this.decayTime = this.maxDecayTime;
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
    sprite: 0,
    checkProximity: function() {
      Tracker.prototype.checkProximity.call(this);
      this.targetVisible = true;
    },
    caughtBy: function(tracker) {
      this.dead = true;
      this.weapon.ready = false;
      this.game.gameOver();
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
    mouseMove: function() {
      if (this.manual && !this.manualX && !this.manualY)
        this.manual = false;
    },
    keyDown: function(e) {
      var key = e.which;
      if (this.dead || !this.directionKeys[key])
        return;
      this.manual = true;
      this.directionKeysPressed[key] = true;
      this.inferManualDirection();
    },
    keyUp: function(e) {
      var key = e.which;
      if (this.dead || !this.directionKeys[key])
        return;
      this.directionKeysPressed[key] = false;
      this.inferManualDirection();
    },
    keyPress: function(e) {
      var key = e.which;
      if (this.dead)
        return;
      if (e.which == 32 && this.player.weapon.ready) {
        this.fire();
      }
    },
    fire: function() {
      this.rest(5, true);
      this.game.pursuitThreshold = Math.min(this.game.pursuitThreshold + this.game.config.pursuitThreshold, 6 * this.game.config.pursuitThreshold);
      this.weapon.fire();
    },
    nextMove: function() {
      var ret = Tracker.prototype.nextMove.call(this);
      this.moving = ret && !this.restRequired && (this.manual ? (this.manualX || this.manualY) : (this.x != this.target.x || this.y != this.target.y));
      return ret;
    }
  });

  window.Zomgbie = Zomgbie;
})($);

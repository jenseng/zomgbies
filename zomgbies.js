(function($) {

  var Zomgbie = function($canvas, options){
    new Game($canvas, options).run();
  };

  var Game = function($canvas, options) {
    this.config = $.extend({}, this.config, options, true);

    this.$canvas = $canvas;
    this.board = new Board($canvas);
    this.stats = new Stats(this);

    this.mouseTarget = new MouseTarget(this.board);
    this.player = new Player(this, this.mouseTarget);
    this.colt = this.player.colt;
    this.agents = new AgentList(this);
    this.agents.push(this.player);
    this.addListeners($canvas);
  };
  Game.prototype = {
    config: {
      maxZombies: 50
    },
    addListeners: function() {
      var $doc = $(document);

      this.$canvas.on('mousemove', function(e) {
        this.mouseTarget.x = e.clientX + 20;
        this.mouseTarget.y = e.clientY * 2 + 160;
        this.player.mouseMove();
      }.bind(this));

      this.$canvas.on('click', function(e) {
        this.mouseTarget.x = e.clientX + 20;
        this.mouseTarget.y = e.clientY * 2 + 160;
        if (this.colt.ready) {
          this.player.rest(5, true);
          this.colt.fire();
        }
      }.bind(this));

      $doc.on('keydown', function(e) {
        if (!this.player.dead)
          this.player.keyDown(e.which);
      }.bind(this));

      $doc.on('keyup', function(e) {
        if (!this.player.dead) {
          this.player.keyUp(e.which);
        }
      }.bind(this));

      $doc.on('keypress', function(e) {
        if (e.which == 32 && this.colt.ready) {
          this.player.rest(5, true);
          this.colt.fire();
        }
      }.bind(this));

      if (this.config.resize) {
        var $window = $(window);
        $window.on('resize', this.board.resize.bind(this.board));
      }
    },
    run: function() {
      this.maybeAddZombies();
      this.agents.move();

      this.agents.sort();
      this.board.render(this.agents, this.colt, this.stats);
      setTimeout(this.run.bind(this), 33);
    },
    maybeAddZombies: function() {
      if (this.agents.numZombies < this.config.maxZombies && Math.random() * 80 < 1) {
        var numZombies = Math.min(Math.ceil(Math.random() * 5), this.config.maxZombies - this.agents.numZombies);
        for (var i = 0; i < numZombies; i++) {
          this.agents.push(new Zombie(this, this.player));
        }
      }
    },
    gameOver: function() {
      var zombie = new Zombie(this);
      zombie.sprite = 0;
      zombie.x = this.player.x;
      zombie.y = this.player.y + 1; // js sort isn't stable, so we want the zombie consistently in the front during rest
      zombie.sleepTime = 40;
      this.agents.push(zombie);
      var messages = this.config.messages.gameOver;
      this.stats.setStatus(messages[parseInt(messages.length * Math.random(), 10)]);
    }
  };

  var Board = function($canvas) {
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
    render: function() {
      this.context.clearRect(0, 0, this.width, this.height);
      var args = [].slice.call(arguments);
      for (var i = 0; i < args.length; i++) {
        args[i].render(this);
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
    render: function(board) {
      var canvas = board.canvas,
          context = board.context,
          colt = this.game.colt,
          player = this.game.player,
          x,
          y,
          i,
          lines;
      context.save();
      context.font = "bold 24px sans-serif";
      context.textBaseline = "baseline";
      context.globalAlpha = 0.6;
      context.fillStyle = player.dead ? '#666' : '#800';
      context.strokeStyle = '#000';
      this.renderLines(context, board, "left", [
        "kills: " + this.kills,
        "streak: " + this.killStreak + " (max: " + this.maxKillStreak + ")",
        "combo: " + this.maxCombo
      ]);
      this.renderLines(context, board, "right", [
        "walkers: " + this.game.agents.numZombies,
        "shots: " + (colt.shots ? colt.shots : "...")
      ]);
      if (this.statusTime) {
        x = board.canvas.width / 2;
        y = board.canvas.height / 2;
        context.textAlign = 'center';
        context.font = "bold 36px sans-serif";
        context.globalAlpha = 0.6 * Math.min(1, 4 * this.statusTime / this.maxStatusTime);
        context.fillText(this.status, x, y);
        context.strokeText(this.status, x, y);
        this.statusTime--;
      }
      context.restore();
    }
  };

  function AgentList(game){
    this.game = game;
  }
  AgentList.prototype = {
    byStacking: [],
    byDistance: [],
    length: 0,
    push: function(item) {
      this.length++;
      this.numZombies++;
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
      for (var i = 0; i < this.length; i++) {
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

  function Colt(game, player){
    this.game = game;
    this.player = player;
  }
  Colt.prototype = {
    shots: 6,
    ready: true,
    maxVisibleTime: 5,
    fire: function() {
      var closest,
          i,
          direction = Math.random() * Math.PI * 2,
          player = this.player,
          agents = this.game.agents,
          agent,
          hitMargin,
          offBy,
          hitCount = 0,
          sound;

      // who do we aim at?
      if (agents.length) {
        for (i = 0; i < agents.byDistance.length; i++) {
          agent = agents.byDistance[i];
          if (agent === player || agent.dead)
            continue;
          closest = agent;
          break;
        }
        if (closest) {
          direction = Math.atan2(closest.distY, closest.distX);
          direction += Math.PI * (Math.random() / 45 - 1 / 90); // off by up to 3 degrees
          for (i = 0; i < agents.byDistance.length; i++) {
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
      }
      this.game.stats.addShotInfo(hitCount);
      direction = Tracker.prototype.normalizeDirection(direction + Math.PI);
      this.lastShot = {x: player.x, y: player.y, direction: direction, visibleTime: this.maxVisibleTime};
      this.shots--;
      sound = this.game.config.sounds.fire[this.shots % 3];
      sound.load();
      sound.play();
      this.disable(800, function() {
        if (!this.shots)
          this.reload();
      });
    },
    reload: function() {
      this.game.config.sounds.reload.load();
      this.game.config.sounds.reload.play();
      this.disable(3000, function() {
        this.shots = 6;
      });
    },
    disable: function(time, callback) {
      this.ready = false;
      setTimeout(function() {
        if (!this.player.dead)
          this.ready = true;
        callback.call(this);
      }.bind(this), time);
    },
    render: function(board) {
      var context = board.context;
      if (this.lastShot && this.lastShot.visibleTime) {
        context.save();
        context.beginPath();
        context.moveTo(this.lastShot.x, this.lastShot.y/2 - 40); // shot fired from 5/9 up player
        context.lineTo(this.lastShot.x + 600 * Math.cos(this.lastShot.direction), (this.lastShot.y + 600 * Math.sin(this.lastShot.direction))/2 - 56); // end of stroke is 7/9 up (through head of zombies)
        context.strokeStyle = '#ccc';
        context.globalAlpha = this.lastShot.visibleTime / this.maxVisibleTime;
        context.stroke();
        context.restore();
        this.lastShot.visibleTime--;
      }
    }
  };

  function Tracker(game, target) {
    this.game = game;
    this.target = target;
  }
  Tracker.prototype = {
    speed: 3,
    size: 36,
    pursuitThreshold: 300,
    pursuitWobble: 20,
    patrolWobble: 30,
    patrolCorrection: 3,
    maxDecayTime: 80,
    randomStart: function(board) {
      var startPos = Math.random() * 2 * (board.width + board.height);
      if (startPos < board.width) {
        this.direction = Math.PI / 2;
        this.set(startPos, 0);
      }
      else if (startPos < board.width + board.height) {
        this.direction = Math.PI;
        this.set(board.width + this.size / 2, startPos - board.width);
      }
      else if (startPos < 2 * board.width + board.height) {
        this.direction = 3 * Math.PI / 2;
        this.set(startPos - board.width - board.height, board.height + this.size * 4);
      }
      else {
        this.direction = 0;
        this.set(-this.size / 2, startPos - 2 * board.width - board.height);
      }
    },
    render: function(board) {
      var context = board.context;
      if (this.dead && !this.decayTime)
        return;
      if (this.decayTime || this.sleepTime) {
        context.save();
        if (this.decayTime)
          context.globalAlpha = this.decayTime > this.maxDecayTime / 2 ? 1 : 2 * this.decayTime / this.maxDecayTime;
        context.translate(Math.round(this.x + this.size), Math.round(this.y/2 - this.size));
        context.rotate(Math.PI / 2);
        context.drawImage(images[this.sprite], 0, 0);
        context.restore();
      }
      else {
        context.drawImage(images[this.sprite], Math.round(this.x - this.size/2), Math.round(this.y/2 - this.size*2));
      }
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
      else if (this.targetVisible && !this.restRequired)
        this.pursue();
      else if (this.restTime)
        this.rest();
      else if (Math.random() < 0.02)
        this.rest(Math.ceil(Math.random() * 40));
      else
        this.patrol();
      return true;
    },
    checkProximity: function() {
      this.targetVisible = false;
      if (this.target && !this.target.dead) {
        this.distX = this.target.x - this.x;
        this.distY = this.target.y - this.y;
        this.dist = Math.sqrt(this.distX * this.distX + this.distY * this.distY);
        this.optimalDirection = Math.atan2(this.distY, this.distX);
        this.targetVisible = this.dist < this.pursuitThreshold;
      }
    },
    wobble: function(degrees) {
      if (!degrees) return 0;
      return Math.PI * (Math.random() * degrees / 90 - degrees / 180);
    },
    normalizeDirection: function(direction) {
      if (direction > Math.PI)
        direction -= 2 * Math.PI;
      else if (direction < -Math.PI)
        direction += 2 * Math.PI;
      return direction;
    },
    manualMove: function() {
      var direction = this.normalizeDirection(Math.atan2(this.manualY, this.manualX));
      if (this.manualX || this.manualY)
        this.move(direction, this.speed);
    },
    pursue: function() {
      if (this.dist < this.speed) { // jump to target
        this.set(this.target.x, this.target.y);
        this.target.caughtBy(this);
        this.restTime = 20;
      }
      else {
        // pursue with a slight wobble
        var direction = this.normalizeDirection(this.optimalDirection + this.wobble(this.pursuitWobble));
        this.move(direction, this.speed);
      }
    },
    patrol: function() {
      // random direction within patrolWobble of previous direction
      var direction = this.normalizeDirection(this.direction + this.wobble(this.patrolWobble));
      if (this.target) {
        // do a slight correction towards target if more than 90deg off
        var difference = this.normalizeDirection(this.optimalDirection - direction);
        if (Math.abs(difference) > Math.PI / 2)
          direction += (difference > 0 ? 1 : -1) * Math.PI * this.patrolCorrection / 180;
      }
      this.move(direction, this.speed * 2 / 3);
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
      this.direction = direction;
      this.set(this.x + distance * Math.cos(direction), this.y + distance * Math.sin(direction));
    },
    set: function(x, y) {
      this.x = x;
      this.y = y;
    },
    headshot: function() {
      this.dead = true;
      this.decayTime = this.maxDecayTime;
    }
  };

  function Zombie(game, target){
    Tracker.call(this, game, target);
    this.sprite = 1 + Math.floor(Math.random() * 15);
    this.randomStart(game.board);
  }
  Zombie.prototype = new Tracker;

  function MouseTarget(board) {
    this.x = board.width/2;
    this.y = board.height/2;
  }
  MouseTarget.prototype = {
    caughtBy: function(){}
  };

  function Player(game, mouseTarget) {
    Tracker.call(this, game, mouseTarget);
    this.set(this.target.x, this.target.y);
    this.directionKeysPressed = {};
    this.colt = new Colt(game, this);
  }
  Player.prototype = new Tracker;
  $.extend(Player.prototype, {
    pursuitWobble: 0,
    speed: 15,
    sprite: 0,
    checkProximity: function() {
      Tracker.prototype.checkProximity.call(this);
      this.targetVisible = true;
    },
    caughtBy: function(tracker) {
      this.dead = true;
      this.colt.ready = false;
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
    keyDown: function(key) {
      if (!this.directionKeys[key])
        return;
      this.manual = true;
      this.directionKeysPressed[key] = true;
      this.inferManualDirection();
    },
    keyUp: function(key) {
      if (!this.directionKeys[key])
        return;
      this.directionKeysPressed[key] = false;
      this.inferManualDirection();
    }
  });

  window.Zomgbie = Zomgbie;
})($);

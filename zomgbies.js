(function() {

  var agents = {
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
      for (var i = 0; i < this.length; i++) {
        this.byDistance[i].distanceIdx = i;
        this.byStacking[i].stackingIdx = i;
      }
    },
    remove: function(agent) {
      var i;
      this.length--;
      this.byDistance.splice(agent.distanceIdx, 1);
      for (i = agent.distanceIdx; i < this.length; i++)
        this.byDistance[i].distanceIdx--;
      this.byStacking.splice(agent.stackingIdx, 1);
      for (i = agent.stackingIdx; i < this.length; i++)
        this.byStacking[i].stackingIdx--;
    }
  };

  var images = [];
  for (var i = 1; i <= 16; i++) {
    var image = new Image();
    image.src = "images/agent" + i + ".png";
    (function(image){
      image.onload = function() { image.loaded = true; };
    }).call(this, image);
    images.push(image);
  }

  var canvas = $('canvas')[0];
  var board = {
    canvas: canvas,
    context: canvas.getContext('2d'),
    resize: function() {
      this.canvas.width = this.canvas.offsetWidth;
      this.canvas.height = this.canvas.offsetHeight;
      this.width = this.canvas.width;
      this.height = this.canvas.height*2;
    }
  };
  board.resize();

  var colt = {
    sounds: {
      fire: $('.colt_sound'),
      reload: $('#reload_sound')[0]
    },
    shots: 6,
    ready: true,
    maxVisibleTime: 5,
    fire: function() {
      var closest,
          i,
          direction = Math.random() * Math.PI * 2,
          agent,
          hitMargin,
          offBy,
          sound;

      // who do we aim at?
      if (agents.length) {
        for (i = 0; i < agents.byDistance.length; i++) {
          agent = agents.byDistance[i];
          if (agent == player || agent.dead)
            continue;
          closest = agent;
          break;
        }
        if (closest) {
          direction = Math.atan2(closest.distY, closest.distX);
          direction += Math.PI * (Math.random() / 45 - 1 / 90); // off by up to 3 degrees
          for (i = 0; i < agents.byDistance.length; i++) {
            agent = agents.byDistance[i];
            if (agent == player || agent.dead)
              continue;
            // will the shot hit this zombie?
            hitMargin = Math.abs(Math.atan2(agent.size / 4, agent.dist));
            offBy =  Math.abs(Math.atan2(agent.distY, agent.distX) - direction);
            if (offBy < hitMargin)
              agent.headshot();
          }
        }
      }
      direction = Tracker.prototype.normalizeDirection(direction + Math.PI);
      this.lastShot = {x: player.x, y: player.y, direction: direction, visibleTime: this.maxVisibleTime};
      this.shots--;
      sound = this.sounds.fire[this.shots % 3];
      sound.load();
      sound.play();
      this.disable(800, function() {
        if (!colt.shots)
          colt.reload();
      });
    },
    reload: function() {
      this.sounds.reload.load();
      this.sounds.reload.play();
      this.disable(3000, function() {
        colt.shots = 6;
      });
    },
    disable: function(time, callback) {
      this.ready = false;
      setTimeout(function() {
        if (!player.dead)
          colt.ready = true;
        callback();
      }, time);
    },
    render: function(context) {
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

  function Tracker(target) {
    this.target = target;
  }
  Tracker.prototype = {
    speed: 4,
    size: 36,
    pursuitThreshold: 300,
    pursuitWobble: 20,
    patrolWobble: 30,
    patrolCorrection: 3,
    maxDecayTime: 80,
    randomStart: function() {
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
    render: function(context) {
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

  function Zombie(target){
    Tracker.call(this, target);
    this.sprite = 1 + Math.floor(Math.random() * 15);
    this.randomStart();
  }
  Zombie.prototype = new Tracker;

  var mouseTarget = {
    x: board.width/2,
    y: board.height/2,
    caughtBy: function(){}
  };

  var player = new Tracker(mouseTarget);
  player.pursuitWobble = 0;
  player.speed = 30;
  player.sprite = 0;
  player.set(mouseTarget.x, mouseTarget.y);
  player.checkProximity = function() {
    Tracker.prototype.checkProximity.call(this);
    this.targetVisible = true;
  };
  player.caughtBy = function(tracker) {
    this.dead = true;
    colt.ready = false;
    var zombie = new Zombie();
    zombie.sprite = 0;
    zombie.x = this.x;
    zombie.y = this.y + 1; // js sort isn't stable, so we want the zombie consistently in the front during rest
    zombie.sleepTime = 40;
    agents.push(zombie);
  };
  player.directionKeys = {
    37: 'W', // left
    38: 'N', // up
    39: 'E', // right
    40: 'S', // down
    65: 'W', // A
    87: 'N', // W
    68: 'E', // D
    83: 'S'  // S
  };
  player.directionKeysPressed = {};
  player.inferManualDirection = function() {
    var directions = {};
    for (key in this.directionKeysPressed) {
      if (this.directionKeysPressed[key])
        directions[this.directionKeys[key]] = true;
    }
    this.manualX = directions.E ^ directions.W ? (directions.E ? 1 : -1) : 0;
    this.manualY = directions.S ^ directions.N ? (directions.S ? 1 : -1) : 0;
  };
  player.mouseMove = function() {
    if (this.manual && !this.manualX && !this.manualY)
      this.manual = false;
  };
  player.keyDown = function(key) {
    if (!this.directionKeys[key])
      return;
    this.manual = true;
    this.directionKeysPressed[key] = true;
    this.inferManualDirection();
  };
  player.keyUp = function(key) {
    if (!this.directionKeys[key])
      return;
    this.directionKeysPressed[key] = false;
    this.inferManualDirection();
  };
  agents.push(player);

  function runIt(board) {
    var total = 50,
        i,
        agent,
        numZombies;
    if (agents.length < total + 1 && Math.random() * 80 < 1) {
      numZombies = Math.min(Math.ceil(Math.random() * 5), total + 1 - agents.length);
      for (i = 0; i < numZombies; i++) {
        agents.push(new Zombie(player));
      }
    }
    board.context.clearRect(0, 0, board.width, board.height);
    agents.sort();
    for (i = 0; i < agents.length; i++) {
      // closest ones get to move first
      agent = agents.byDistance[i];
      if (!agent.nextMove()) {
        agents.remove(agent);
        i--;
      }
    }
    for (i = 0; i < agents.byStacking.length; i++) {
      agents.byStacking[i].render(board.context);
    }
    colt.render(board.context);
    setTimeout(runIt.bind(this, board), 50);
  }

  var $doc = $(document);
  $doc.on('mousemove', function(e) {
    mouseTarget.x = e.clientX + 20;
    mouseTarget.y = e.clientY * 2 + 160;
    player.mouseMove();
  });
  $doc.on('click', function(e) {
    mouseTarget.x = e.clientX + 20;
    mouseTarget.y = e.clientY * 2 + 160;
    if (colt.ready) {
      player.rest(5, true);
      colt.fire();
    }
  });

  $doc.on('keydown', function(e) {
    if (!player.dead)
      player.keyDown(e.which);
  });
  $doc.on('keyup', function(e) {
    if (!player.dead) {
      player.keyUp(e.which);
    }
  });
  $doc.on('keypress', function(e) {
    if (e.which == 32 && colt.ready) {
      player.rest(5, true);
      colt.fire();
    }
  });

  var $window = $(window);
  $window.on('resize', board.resize.bind(board));

  runIt(board);
})();

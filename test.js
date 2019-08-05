var Tracker = require('./');
var _ = require('lodash');
var Sequelize = require('sequelize');
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var assert = chai.assert;
var eventually = assert.eventually;
var moment = require('moment');
var sequelize = require('sequelize');

function initDB(options) {
  options = typeof options === 'undefined' ? {} : options;
  var sequelize = new Sequelize('', '', '', {
    dialect: 'postgres',
    logging: false
  });

  var Target = sequelize.define('Target', {
    name: Sequelize.TEXT,
    email: Sequelize.TEXT,
    parameters: Sequelize.ARRAY((Sequelize.JSON)),
  });

  var Target2 = sequelize.define('Target2', {
    name: Sequelize.TEXT,
    email: Sequelize.TEXT,
    parameters: Sequelize.ARRAY((Sequelize.JSON)),
  });

  var Relationship = sequelize.define('Relationship', {
    target_id: Sequelize.INTEGER,
    user_id: Sequelize.INTEGER
  });

  var User = sequelize.define('User', {
    name: Sequelize.TEXT
  });

  Target.belongsToMany(User, { through: Relationship });
  User.belongsToMany(Target, { through: Relationship });

  var trackerOptions = {
    userModel: User
  };

  var trackerOptionsCustom = {
    userModel: User,
    changes: ['create', 'delete', 'update']
  }

  trackerOptions = _.assign(trackerOptions, options);

  var Logger = Tracker(Target, sequelize, trackerOptions);
  var RelationshipLogger = Tracker(Relationship, sequelize, trackerOptions);
  var Logger2 = Tracker(Target2, sequelize, trackerOptionsCustom);

  return {
    sequelize,
    initiation: sequelize.sync({ force: true }),
    tracker: Logger,
    RelationshipTracker: RelationshipLogger,
    tracker2: Logger2
  }
}

function getUserFixture() {
  return {
    name: 'test_user'
  };
}

function getTargetFixture() {
  return {
    name: 'test_target',
    email: 'test@target.com',
    parameters: [{
      age: 25,
      height: 159
    }, {
      age: 32,
      height: 183
    }]
  };
}

function assertCount(model, n, opts) {
  return function(obj) {
    return model.count(opts)
    .then(function(count) {
      assert.equal(count, n, "log entries")
      return obj;
    });
  }
}

describe('hooks default', function() {
  var database, target, user, targetLog, user_id, target2;
  beforeEach(function(done) {
    var testSuite = initDB();
    testSuite.initiation.then(function(db) {
    database = db;
    target = database.models.Target;
    target2 = database.models.Target2;
    user = database.models.User;
    targetLog = database.models.TargetLog;
    target2Log = database.models.Target2Log;
    relationship = database.models.Relationship;
    user.create(getUserFixture())
    .then(function(newUser) {
      user_id = newUser.id;
      done();
    });
  })
  });

  afterEach(function() {
    database.close();
  });

  it('onCreate: should store a record in log db', function() {
    return target.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(assertCount(targetLog, 1))
    .finally(assertCount(target, 1))
  });

  it('onCreate: should store a record in log db with data', function() {
    return target2.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(() => {
      return target2Log.findAll()
      .then((logs) => {
        assert.deepEqual(logs[0].changes, [{
          value: getTargetFixture().name,
          previousValue: "",
          field: "name"
        }, {
          value: getTargetFixture().email,
          previousValue: "",
          field: "email"
        }, {
          value: getTargetFixture().parameters,
          previousValue: "",
          field: "parameters"
        }]);
      });
    });
  });

  it('onCreate: should not store a record in log db with data', function() {
    return target.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(() => {
      return targetLog.findAll()
      .then((logs) => {
        assert.equal(logs[0].changes, null);
      });
    });
  });

  it('onBulkCreate: should store a record in log db with data', function() {
    return target2.bulkCreate([getTargetFixture()], {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(() => {
      return target2Log.findAll()
      .then((logs) => {
        assert.deepEqual(logs[0].changes, [{
          value: getTargetFixture().name,
          previousValue: "",
          field: "name"
        }, {
          value: getTargetFixture().email,
          previousValue: "",
          field: "email"
        }, {
          value: getTargetFixture().parameters,
          previousValue: "",
          field: "parameters"
        }]);
      });
    });
  });

  it('onBulkCreate: should not store a record in log db with data', function() {
    return target.bulkCreate([getTargetFixture()], {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(() => {
      return targetLog.findAll()
      .then((logs) => {
        assert.equal(logs[0].changes, null);
      });
    });
  });

  it('onDelete: should store a record in log db with data', function() {
    return target2.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then((t) => {
      return t.destroy({
        trackOptions: {
          user_id: user_id
        }
      })
      .then(() => {
        return target2Log.findAll({
          where: {
            action: 'delete'
          }
        })
        .then((logs) => {
          assert.deepEqual(logs[0].changes, [{
            value: "",
            previousValue: getTargetFixture().name,
            field: "name"
          }, {
            value: "",
            previousValue: getTargetFixture().email,
            field: "email"
          }, {
            value: "",
            previousValue: getTargetFixture().parameters,
            field: "parameters"
          }]);
        });
      });
    });
  });

  it('onDelete: should store a record in log db with data', function() {
    return target.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then((t) => {
      return t.destroy({
        trackOptions: {
          user_id: user_id
        }
      })
      .then(() => {
        return targetLog.findAll({
          where: {
            action: 'delete'
          }
        })
        .then((logs) => {
          assert.equal(logs[0].changes, null);
        });
      });
    });
  });

  it('onBulkDelete: should store a record in log db with data', function() {
    return target2.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then((t) => {
      return target2.destroy({
        where: {
          id: [t.id]
        },
        trackOptions: {
          user_id: user_id
        }
      })
      .then(() => {
        return target2Log.findAll({
          where: {
            action: 'delete'
          }
        })
        .then((logs) => {
          assert.deepEqual(logs[0].changes, [{
            value: "",
            previousValue: getTargetFixture().name,
            field: "name"
          }, {
            value: "",
            previousValue: getTargetFixture().email,
            field: "email"
          }, {
            value: "",
            previousValue: getTargetFixture().parameters,
            field: "parameters"
          }]);
        });
      });
    });
  });

  it('onBulkDelete: should store a record in log db with data', function() {
    return target.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then((t) => {
      return target.destroy({
        where: {
          id: [t.id]
        },
        trackOptions: {
          user_id: user_id
        }
      })
      .then(() => {
        return targetLog.findAll({
          where: {
            action: 'delete'
          }
        })
        .then((logs) => {
          assert.equal(logs[0].changes, null);
        });
      });
    });
  });

  it('onUpdate: should not log the change to db', function() {
    return target.create(getTargetFixture(), {
      trackOptions: {
        user_id: user_id
      }
    })
    .then(function(target) {
      target.name = "foo_target";
      return target.save({ trackOptions: { track: false } })
      .then(() => {
        return targetLog.findAll()
        .then((logs) => {
          assert.equal(logs[0].action, "create");
          assert.equal(logs.length, 1);
        });
      })
    })
    .finally(assertCount(target, 1))
  });

  it('onBulkUpdate: should not log the change to db', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      return target.update({ name: "foo_target"}, {
        where: { id: t.id },
        trackOptions: { track: false }
      });
    }).then(assertCount(targetLog, 1))
  });

  it('onCreate/onUpdate/onDestroy: should store 3 records in log db', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(target) {
      target.name = "foo_target";
      return target.save({ trackOptions: { user_id: user_id } });
    }).then(assertCount(targetLog, 2))
    .then(function(target) {
      return target.destroy({ trackOptions: { user_id: user_id } });
    }).then(assertCount(targetLog, 3))
  });

  it('onUpdate: should store the correct values', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(target){
      target.name = "foo_target";
      target.email = "foo@target.com"
      return target.save({ trackOptions: { user_id: user_id } });
    }).then(assertCount(targetLog, 2))
    .then(function() {
      return targetLog.findAll();
    }).then(function(logs) {
      assert.equal(logs[0].action, "create");
      assert.deepEqual(logs[1].changes, [{
        value: "foo_target",
        previousValue: "test_target",
        field: "name"
      }, {
        value: "foo@target.com",
        previousValue: "test@target.com",
        field: "email"
      }]);
      assert.equal(logs[1].action, "update");
    });
  });

  it('onCreate/onBulkUpdate: should store 2 records in log db', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      // Sequelize runs bulkUpdate in this case
      return target.update({ name: "foo_target"}, {
        where: { id: t.id },
        trackOptions: { user_id: user_id }
      });
    }).then(assertCount(targetLog, 2))
  });

  it('onFind: should only store a record in log db if track is true', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      return target.findOne({
        where: { id: t.id }
      });
    }).then(assertCount(targetLog, 1))
    .then(function(t) {
      return target.findOne({
        where: { id: t.id },
        trackOptions: { track: true, user_id: user_id }
      });
    }).then(assertCount(targetLog, 2))
  });

  it('onFindAll: should store a record in db', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function() {
      return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
      .then(assertCount(targetLog, 2))
      .then(function() {
        return target.findAll({
          trackOptions: { track: true, user_id: user_id }
        });
      }).then(assertCount(targetLog, 4))
    })
  });

  it('onFindAll: should not error if record not found', function() {
    return target.findAll({
      trackOptions: { track: true, user_id: user_id }
    });
  });

  it('onFindOne: should not error if record not found', function() {
    return target.findOne({
      where: {
        id: 999
      },
      trackOptions: { track: true, user_id: user_id }
    });
  });

  it('onUpdate: should not error if record not found', function() {
    return target.update({ name: 'foo_test'}, {
      where: {
        id: 999
      },
      trackOptions: { track: true, user_id: user_id }
    });
  });

  it('onDelete: should not error if record not found', function() {
    return target.destroy({
      where: {
        id: 999
      },
      trackOptions: { track: true, user_id: user_id }
    });
  });

  it('onCreate: should error when trackOptions not provided', function() {
    var promise =  target.create(getTargetFixture(), {});
    return assert.isRejected(promise, 'user_id is required in tracker options.');
  });
  it('onCreate: should error when options not provided', function() {
    var promise =  target.create(getTargetFixture());
    return assert.isRejected(promise, 'user_id is required in tracker options.');
  });

  it('onUpdate: should error when trackOptions not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      var promise = t.update({ name: 'foo_test'}, {})
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });
  it('onUpdate: should error when options not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      var promise = t.update({ name: 'foo_test'})
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });

  it('onDelete: should error when trackOptions not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      var promise = t.destroy({})
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });
  it('onDelete: should error when options not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      var promise = t.destroy()
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });

  it('onFind: should error when track true, but trackOptions not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      var promise = target.findOne({
        where: { id: t.id },
        trackOptions: { track: true }
      })
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });

  it('onFindAll: should error when trackOptions not provided', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function() {
      var promise = target.findAll({ trackOptions: { track: true } })
      return assert.isRejected(promise, 'user_id is required in tracker options.');
    });
  });

  it('onDelete: should not delete the logs', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      return t.destroy({ trackOptions: { user_id: user_id } })
    })
    .then(assertCount(targetLog, 2))
  });

  it('onUpdate: should store record of changed json correctly when .save', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      var params = _.cloneDeep(t.get('parameters'));
      params[0].height = 160;
      t.set('parameters', params);
      return t.save({ trackOptions: { user_id: user_id } })
    })
    .then(assertCount(targetLog, 2))
    .then(function() {
      return targetLog.findAll()
      .then(function(log) {
        var dataBefore = getTargetFixture();
        var dataAfter = getTargetFixture();
        dataAfter.parameters[0].height = 160;
        var expecting = {
          field: 'parameters',
          value: dataAfter.parameters,
          previousValue: dataBefore.parameters
        };
        assert.deepEqual(log[1].changes[0], expecting);
      })
    })
  });

  it('onUpdate: should store record of changed json correctly when .update', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      t.parameters[0].height = 160;
      return target.update({
        parameters: t.parameters
      }, {
        trackOptions: {
          user_id: user_id
        },
        where: {
          id: t.id
        }
      })
    })
    .then(assertCount(targetLog, 2))
    .then(function() {
      return targetLog.findAll()
      .then(function(log) {
        var dataBefore = getTargetFixture();
        var dataAfter = getTargetFixture();
        dataAfter.parameters[0].height = 160;
        var expecting = {
          field: 'parameters',
          value: dataAfter.parameters,
          previousValue: dataBefore.parameters
        };
        assert.deepEqual(log[1].changes[0], expecting);
      })
    })
  });

});

describe('hooks with cascade', function() {
  var database, target, user, targetLog, user_id;
  beforeEach(function(done) {
    var options = {
      persistant: false
    };
    var testSuite = initDB(options);
    testSuite.initiation.then(function(db) {
    database = db;
    target = database.models.Target;
    user = database.models.User;
    targetLog = database.models.TargetLog
    user.create(getUserFixture())
    .then(function(newUser) {
      user_id = newUser.id;
      done();
    });
  })
  });

  afterEach(function() {
    database.close();
  });

  it('onDelete: should delete the logs with cascade', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      return t.destroy({ trackOptions: { user_id: user_id } })
      .then(assertCount(targetLog, 0))
    })
  });

});

describe('read-only ', function() {
  var database, target, user, targetLog, user_id;
  beforeEach(function(done) {
    var testSuite = initDB();
    testSuite.initiation.then(function(db) {
      database = db;
      target = database.models.Target;
      user = database.models.User;
      targetLog = database.models.TargetLog
      user.create(getUserFixture())
      .then(function(newUser) {
        user_id = newUser.id;
        done();
      });
    })
  });

  afterEach(function() {
    database.close();
  });

  it('cannot update existing log', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(log) {
      return log.update({ name: 'bla' }, { trackOptions: { user_id: user_id } })
      .catch((function(err) {
        return assert.isRejected(err, Error, "Validation error");
      }))
    });
  });

  it('cannot delete existing log', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(log) {
      return log.destroy({ trackOptions: { user_id: user_id } })
      .catch((function(err) {
        return assert.isRejected(err, Error, "Validation error");
      }))
    });
  });
});

describe('logged data', function() {
  var database, target, user, targetLog, user_id, trackerObject;
  beforeEach(function(done) {
    var testSuite = initDB();
    trackerObject = testSuite.tracker;
    testSuite.initiation.then(function(db) {
    database = db;
    target = database.models.Target;
    user = database.models.User;
    targetLog = database.models.TargetLog
    user.create(getUserFixture())
    .then(function(newUser) {
      user_id = newUser.id;
      done();
    });
  })
  });

  afterEach(function() {
    database.close();
  });

  it('returns track object', function() {
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(assertCount(targetLog, 1))
    .then(function(t) {
      return targetLog.findAll({
        where: {
          target_id: t.id
        }
      })
      .then(assertCount(targetLog, 1))
      .finally(function() {
        assert.deepEqual(trackerObject, targetLog);
      });
    })
  });

  it('timestamp is saved correctly', function() {
    var beginning = moment().subtract(10, 'seconds');
    var end = moment().add(10, 'seconds');
    return target.create(getTargetFixture(), { trackOptions: { user_id: user_id } })
    .then(function(t) {
      return targetLog.findAll()
      .then(function(log) {
        var timestamp = log[0].timestamp;
        var isWithin = moment(timestamp).isAfter(beginning) && moment(timestamp).isBefore(end);
        assert(isWithin);
      })
      .finally(assertCount(targetLog, 1));
    })
  });

});

describe('transactions', function() {
  var database, target, user, targetLog, user_id, testSuite;
  beforeEach(function(done) {
    var options = {
      persistant: false
    };
    testSuite = initDB(options);
    testSuite.initiation.then(function(db) {
    database = db;
    target = database.models.Target;
    user = database.models.User;
    targetLog = database.models.TargetLog
    user.create(getUserFixture())
    .then(function(newUser) {
      user_id = newUser.id;
      done();
    });
  })
  });

  afterEach(function() {
    database.close();
  });

  it('Transaction - onCreate: should wait transaction to commit', function() {
    return testSuite.sequelize.transaction(t => {
      return target.create(getTargetFixture(), {
        trackOptions: {
          user_id: user_id
        },
        transaction: t
      })
      .then(() => {
        return target.create(getTargetFixture(), {
          trackOptions: {
            user_id: user_id
          },
          transaction: t
        })
      })
    })
    .finally(assertCount(target, 2));
  });

});
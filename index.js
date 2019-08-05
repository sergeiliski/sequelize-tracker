var _ = require('lodash');
var moment = require('moment');

var excludeAttributes = function(obj, attrsToExclude){
  return _.omit(obj, attrsToExclude);
}

var Tracker = function(model, sequelize, trackerOptions) {
  if (!trackerOptions || !_.isObject(trackerOptions)) {
    throw new Error('Option object is mandatory.');
  }

  if (!model) {
    throw new Error('Target model is mandatory.');
  }

  if (!trackerOptions.userModel) {
    throw new Error('Options must include name of the user model.');
  }
  if (!_.isString(model) && (!_.isObject(model) || !model.sequelize)) {
    throw new Error('Target model needs to be a string or Sequelize model object.');
  }

  if (!_.isString(trackerOptions.userModel) && (!_.isObject(trackerOptions.userModel) || !trackerOptions.userModel.sequelize)) {
    throw new Error('User model needs to be a string or Sequelize model object.');
  }

  var trackerDefaultOptions = {
    persistant: true,
    changes: ['update']
  };
  trackerOptions = _.extend({}, trackerDefaultOptions, trackerOptions);
  var trackedModel = _.isString(trackerOptions.userModel) ? sequelize.model(trackerOptions.userModel) : trackerOptions.userModel;
  var targetModel = _.isString(model) ? sequelize.model(model) : model;
  var Sequelize = sequelize.Sequelize;
  var trackName = targetModel.name + 'Log';

  var trackAttributes = {
    changes: {
      type: Sequelize.ARRAY((Sequelize.JSON)),
      allowNull: true,
      defaultValue: null,
    },
    metadata: {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    },
    action: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    timestamp: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    }
  };

  var excludedAttributes = ["id", "createdAt", "updatedAt"];

  trackAttributes = _.assign({}, trackAttributes);

  var trackOwnOptions = {
    timestamps: false
  };
  var trackOptions = _.assign({}, trackOwnOptions);
  
  var modelTrack = sequelize.define(trackName, trackAttributes, trackOptions);

  var modelOptions = {
    onDelete: trackerOptions.persistant ? false : 'CASCADE'
  };

  modelTrack.belongsTo(targetModel, _.assign({
    foreignKey: 'target_id'
  }, modelOptions));
  modelTrack.belongsTo(trackedModel, _.assign({
    foreignKey: 'user_id'
  }, modelOptions));

  var createHook = function(obj, options) {
    checkMandatoryHookOptions(options);

    var values = excludeAttributes(obj.dataValues, excludedAttributes);
    var changes = [];
    _.forOwn(values, function(value, key) {
      changes.push({
        value: value,
        previousValue: '',
        field: key
      });
    });

    var dataValues = {
      changes,
      target_id: obj.id,
      action: 'create',
      user_id: options.trackOptions.user_id,
      metadata: options.trackOptions.metadata
    }

    if (trackerOptions.changes.indexOf('create') < 0) {
      delete dataValues.changes;
    }

    return modelTrack.create(dataValues, {
      transaction: options.transaction
    });
  }

  var createBulkHook = function(obj, options) {
    if (isDoNotTrack(options)) {
      return false;
    }
    checkMandatoryHookOptions(options);

    var dataValues = _.map(obj, function(o) {
      var values = excludeAttributes(o.dataValues, excludedAttributes);
      var changes = [];
      _.forOwn(values, function(value, key) {
        changes.push({
          value: value,
          previousValue: '',
          field: key
        });
      });
      return {
        changes,
        target_id: o.id,
        action: 'create',
        user_id: options.trackOptions.user_id,
        metadata: options.trackOptions.metadata
      };
    });

    // Refactor later (done: 5 August 2019)
    if (trackerOptions.changes.indexOf('create') < 0) {
      _.forEach(dataValues, function(value, i) {
        delete dataValues[i].changes;
      });
    }

    return modelTrack.bulkCreate(dataValues, {
      transaction: options.transaction
    });
  }

  var updateHook = function(obj, options) {
    if (isDoNotTrack(options)) {
      return false;
    }
    checkMandatoryHookOptions(options);

    var values = excludeAttributes(obj.dataValues, excludedAttributes);
    var changes = [];
    _.forOwn(values, function(value, key) {
      if (!!obj.previous(key) && !_.isEqual(obj.previous(key), value)) {
        changes.push({
          value: value,
          previousValue: obj.previous(key),
          field: key
        });
      }
    });

    var dataValues = {
      changes,
      target_id: obj.id,
      action: 'update',
      user_id: options.trackOptions.user_id,
      metadata: options.trackOptions.metadata
    }

    return modelTrack.create(dataValues, {
      transaction: options.transaction
    });
  }

  var updateBulkHook = function(options) {
    if (isDoNotTrack(options)) {
      return false;
    }
    checkMandatoryHookOptions(options);

    return targetModel.findAll({
        where: options.where
      })
    .then(function(data) {
      if (data) {
        var dataValues = _.map(data, function(obj) {
          var values = excludeAttributes(obj.dataValues, excludedAttributes);
          changes = [];
          _.forOwn(values, function(value, key) {
            if (!!options.attributes[key] && !_.isEqual(options.attributes[key], value)) {
              changes.push({
                value: options.attributes[key],
                previousValue: value,
                field: key
              })
            }
          });
          return {
            changes,
            target_id: obj.id,
            action: 'update',
            user_id: options.trackOptions.user_id,
            metadata: options.trackOptions.metadata
          }
        });

        return modelTrack.bulkCreate(dataValues, {
          transaction: options.transaction
        });
      }
    });
  }

  var deleteHook = function(obj, options) {
    checkMandatoryHookOptions(options);

    var values = excludeAttributes(obj.dataValues, excludedAttributes);
    var changes = [];
    _.forOwn(values, function(value, key) {
      changes.push({
        value: '',
        previousValue: value,
        field: key
      })
    });

    var dataValues = {
      changes,
      target_id: obj.id,
      action: 'delete',
      user_id: options.trackOptions.user_id,
      metadata: options.trackOptions.metadata
    }

    if (trackerOptions.changes.indexOf('delete') < 0) {
      delete dataValues.changes;
    }

    return modelTrack.create(dataValues, {
      transaction: options.transaction
    });
  }

  var deleteBulkHook = function(options) {
    checkMandatoryHookOptions(options);

    return targetModel.findAll({
      where: options.where
    })
    .then(function(data) {
      if (data) {
        var dataValues = _.map(data, function(obj) {
          var values = excludeAttributes(obj.dataValues, excludedAttributes);
          changes = [];
          _.forOwn(values, function(value, key) {
            changes.push({
              value: '',
              previousValue: value,
              field: key
            })
          });
          return {
            changes,
            target_id: obj.id,
            action: 'delete',
            user_id: options.trackOptions.user_id,
            metadata: options.trackOptions.metadata
          }
        });

        // Refactor later (done: 5 August 2019)
        if (trackerOptions.changes.indexOf('delete') < 0) {
          _.forEach(dataValues, function(value, i) {
            delete dataValues[i].changes;
          });
        }

        return modelTrack.bulkCreate(dataValues, {
          transaction: options.transaction
        });
      }
    });
  }


  var findHook = function(obj, options) {
    if (!options || !options.trackOptions || !options.trackOptions.track) {
      return false;
    }
    
    checkMandatoryHookOptions(options);

    if (!obj) {
      return false;
    }

    var objects = obj instanceof Array ? obj : [obj];
    var dataValues = _.map(objects, function(o) {
      return {
        target_id: o.id,
        action: 'find',
        user_id: options.trackOptions.user_id,
        metadata: options.trackOptions.metadata
      };
    })

    return modelTrack.bulkCreate(dataValues, {
      transaction: options.transaction
    });
  }

  var isDoNotTrack = function(options) {
    if (!options || !options.trackOptions) {
      // if no options given or options does not have trackOptions -> log
      return false;
    }
    if (typeof options.trackOptions.track === 'boolean' && options.trackOptions.track === false) {
      // if track property is typeof boolean (is not undefined) and is set to false -> dont log
      return true;
    }
    return false;
  }

  var checkMandatoryHookOptions = function(options, optional) {
    if (optional) {
      if (!options || !options.trackOptions || !options.trackOptions.track) {
        return false;
      }
    }

    if (!options || !options.trackOptions || !options.trackOptions.user_id) {
      throw new Error('user_id is required in tracker options.');
    }
  }

  var readOnlyHook = function() {
    throw new Error("This is a read-only log. You cannot modify it.");
  };

  targetModel.hook('afterFind', findHook);
  targetModel.hook('afterCreate', createHook);
  targetModel.hook('afterBulkCreate', createBulkHook);
  targetModel.hook('beforeUpdate', updateHook);
  targetModel.hook('beforeBulkUpdate', updateBulkHook);
  targetModel.hook('beforeDestroy', deleteHook);
  targetModel.hook('beforeBulkDestroy', deleteBulkHook);

  modelTrack.hook('beforeUpdate', readOnlyHook);
  modelTrack.hook('beforeDestroy', readOnlyHook);

  return modelTrack;
};

module.exports = Tracker;
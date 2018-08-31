var _ = require('lodash');

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
    persistant: true
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
      defaultValue: new Date(),
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

    var dataValues = {
      target_id: obj.id,
      action: 'create',
      user_id: options.trackOptions.user_id,
      metadata: options.trackOptions.metadata
    }

    return modelTrack.create(dataValues);
  }

  var updateHook = function(obj, options) {
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

    return modelTrack.create(dataValues);
  }

  var updateBulkHook = function(options) {
    checkMandatoryHookOptions(options);

    return targetModel.findAll({
        where: options.where
      })
    .then(function(data) {
      if(data) {
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

        return modelTrack.bulkCreate(dataValues);
      }
    });
  }

  var deleteHook = function(obj, options) {
    checkMandatoryHookOptions(options);

    var dataValues = {
      target_id: obj.id,
      action: 'delete',
      user_id: options.trackOptions.user_id,
      metadata: options.trackOptions.metadata
    }

    return modelTrack.create(dataValues);
  }

  var findHook = function(obj, options) {
    if (!options || !options.trackOptions || !options.trackOptions.track) {
      return false;
    }
    
    checkMandatoryHookOptions(options);

    var objects = obj instanceof Array ? obj : [obj];
    var dataValues = _.map(objects, function(o) {
      return {
        target_id: o.id,
        action: 'find',
        user_id: options.trackOptions.user_id,
        metadata: options.trackOptions.metadata
      };
    })

    return modelTrack.bulkCreate(dataValues);
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
  targetModel.hook('beforeUpdate', updateHook);
  targetModel.hook('beforeBulkUpdate', updateBulkHook);
  targetModel.hook('beforeDestroy', deleteHook);

  modelTrack.hook('beforeUpdate', readOnlyHook);
  modelTrack.hook('beforeDestroy', readOnlyHook);

  return targetModel;
};

module.exports = Tracker;
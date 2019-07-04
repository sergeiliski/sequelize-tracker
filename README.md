Sequelize Tracker
=============================
Track changes to your models. See who has looked at or changed the models data and how it was changed.

[![Build Status](https://travis-ci.org/sergeiliski/sequelize-tracker.svg?branch=master)](https://travis-ci.org/sergeiliski/sequelize-tracker)

Installation
------------

```bash
npm install sequelize-tracker
```

How to use
----------

### 1) Import `sequelize-tracker`

```js
var Sequelize = require('sequelize');
var Tracker = require('sequelize-tracker');
```

Create a sequelize instance and your models, e.g.

```js
var sequelize = new Sequelize('', '', '', {
  dialect: 'postgres'
});
```

### 2) Add the *tracker* feature to your models

```js
var Target = sequelize.define('Target', attributes, options);

Tracker(Target, sequelize, options);
```

### 3) Use it in your queries

All `create`, `update` and `destroy` queries are logged by default. You just need to pass `trackOptions` object with `user_id` in options.

```js
  model.create(data, {
    trackOptions: {
      user_id: // users id
    }
  })
```

`update` can be set to ignore changes by passing `track: false` in `trackOptions`.
```js
  model.update(data, {
    trackOptions: {
      track: false
    }
  })
```

By default `find` does not logged. You will need explicitly to pass `track: true` in `trackOptions`.

```js
  model.findAll({
    trackOptions: {
      track: true,
      user_id: // users id
    }
  })
```

Only update has a bulk update trigger. If you want to log other bulk operations. Use `individualHooks: true`.

By default there will be no user metadata saved. If you want to log this, pass all metadata information you want to `metadata` in `trackOptions`.

```js
  model.create(data, {
    trackOptions: {
      user_id: // users id,
      metadata: // metadata object
    }
  })
```

###### Note:

Sequelize doesn't do deep equal checks. This means that when using `instance.save()`, the `changed` isn't triggered on fields that are data type `JSON` or `Array`. You have to use the setter `set`.

http://docs.sequelizejs.com/class/lib/model.js~Model.html#instance-method-set

Alternatively you can use `model.update()` which uses `set` internally.

### 4) How it is logged

Tracker creates a table and a model. Model is affixed with `Log` and table is affixed with `Logs`.

Table fields:

| changes                   | metadata      | action   | timestamp | user_id    | target_id  |
| :-----------------------: |:-------------:| :-----:  |:---------:|:----------:|:----------:|
| `Array<Object> || null`   | `Object`      | `String` |   `Date`  | `Integer`  | `Integer`  |

Changes object example:

```js
[{
  field: 'name',
  value: 'John',
  previousValue: 'Michael'
}]
```

Action is `find`, `create`, `update` or `delete`.

Options
-------

The default syntax for `Tracker` is:

`Tracker(model, sequelizeInstance, options)`

whereas the options are listed here (with default value).

```js
{
  // By default it keeps all logs after tracked item is deleted
  persistant: true
}
```

License
-------

The MIT License (MIT)

Copyright (c) 2018 Sergei Liski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
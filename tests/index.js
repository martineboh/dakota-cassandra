// node modules
var nmCassandra = require('cassandra-driver');
var nmDakota = require('../index');
var nmKeyspace = require('../lib/keyspace');
var nmLogger = require('../lib/logger');
var nmQuery = require('../lib/query');
var nmSchema = require('../lib/schema');
var nmTable = require('../lib/table');
var nmTypes = require('../lib/types');
var nmUserDefinedType = require('../lib/user_defined_type');
var nmWhen = require('when');
var nm_ = require('underscore');

// ================
// = Tests to Run =
// ================
var RUN_TESTS = {
  keyspaces: false,
  tables: false,
  models: false,
  queries: false,
  userDefinedTypes: false,
  complexTypes: false,
  getterSetter: false,
  counter: false,
  collections: false,
  inject: false,
  alias: false,
  instanceQueries: false,
  removeMapKey: false,
  blindUpdates: false,
  collectionOfCollections: false,
  dbValidator: false,
  injectNull: false,
  deleteCallbacks: false,
  streams: true
};

// ===========
// = Connect =
// ===========

var options = {
  
  // connection
  connection: {
    contactPoints: [
      '127.0.0.1'
    ],
    keyspace: 'dakota_test'
  },
  
  // keyspace
  keyspace: {
    replication: { 'class': 'SimpleStrategy', 'replication_factor': 1 },
    durableWrites: true,
    ensureExists: {
      run: true, // check if keyspace exists and automaticcaly create it if it doesn't
      alter: true // alter existing keyspace to match replication or durableWrites
    }
  },
  
  // logging
  logger: {
    level: 'debug',
    queries: true
  },
  
  // model
  model: {
    table: {
      ensureExists: {
        run: true, // check if keyspace exists and automaticcaly create it if it doesn't
        recreate: false, // drop and recreate table on schema mismatch, takes precedence over following options
        recreateColumn: true,  // recreate columns where types don't match schema
        removeExtra: true,  // remove extra columns not in schema
        addMissing: true // add columns in schema that aren't in table
      }
    }
  },
  
  // user defined type
  userDefinedType: {
    ensureExists: {
      run: true,
      recreate: false, // drop and recreate type on schema mismatch, takes precedence over following options
      changeType: true, // change field types to match schema
      addMissing: true // add fields in schema that aren't in type
    }
  }
  
};

var userDefinedTypes = {
  address: require('./user_defined_types/address')
};

var dakota = new nmDakota(options, userDefinedTypes);

// models
var User = require('./models/user')(dakota);
var Counter = require('./models/counter')(dakota);

// =============
// = Keyspaces =
// =============
(function(run) {
  if (!run) {
    return;
  }
  
  // copy connection contactPoints, ignore keyspace
  var connection = {};
  connection.contactPoints = dakota._options.connection.contactPoints;
  
  var replication = dakota._options.keyspace.replication;
  var durableWrite = dakota._options.keyspace.durableWrites;
  
  // create client with no keyspace, keyspace queries need to run with no keyspace
  var client = new nmCassandra.Client(connection);
  
  // create keyspace object
  var keyspace = new nmKeyspace(client, 'dakota_test_keyspace', replication, durableWrite);
  
  // create if doesn't exist
  keyspace.create(function(err) {
    if (err) {
      nmLogger.error('Error creating keyspace: ' + err + '.');
    }
    else {
      nmLogger.info('Created keyspace successfully.');
      
      // alter keyspace's replication strategy and durable writes
      keyspace.alter({ 'class' : 'SimpleStrategy', 'replication_factor' : 3 }, false, function(err) {
        if (err) {
          nmLogger.error('Error altering keyspace: ' + err + '.');
        }
        else {
          nmLogger.info('Altered keyspace successfully.');
          
          // drop keyspace if exists
          keyspace.drop(function(err) {
            if (err) {
              nmLogger.error('Error dropping keyspace: ' + err + '.');
            }
            else {
              nmLogger.info('Dropped keyspace successfully.');
              
              client.shutdown();
            }
          }, { ifExists: true });
        }
      });
    }
  }, { ifNotExists: true });
  
})(RUN_TESTS.keyspaces);

// ==========
// = Tables =
// ==========
(function(run) {
  if (!run) {
    return;
  }
  
  // get table instance from User model
  var schemaDefinition = require('./models/user.schema');
  var schema = new nmDakota.Schema(dakota, schemaDefinition, {});
  var table = new nmTable(dakota, 'user_tests', schema, {});
  
  // drop table
  table.drop(function(err, result) {
    if (err) {
      nmLogger.error('Error dropping table: ' + err + '.');
    }
    else {
      nmLogger.info('Dropped table successfully.');
      
      // create table if not exists
      table.create(function(err) {
        if (err) {
          nmLogger.error('Error creating table: ' + err + '.');
        }
        else {
          nmLogger.info('Created table successfully.');
          
          // retrieve table schema from system table
          table.selectSchema(function(err) {
            if (err) {
              nmLogger.error('Error getting table schema: ' + err + '.');
            }
            else {
              nmLogger.info('Retrieved table schema successfully.');
              
              // alter table
              table.addColumn('new_column', 'map<text,text>', function(err) {
                if (err) {
                  nmLogger.error('Error adding column: ' + err + '.');
                }
                else {
                  nmLogger.info('Added column successfully.');
                  
                  // alter table
                  table.renameColumn('id', 'id_new', function(err) {
                    if (err) {
                      nmLogger.error('Error renaming column: ' + err + '.');
                    }
                    else {
                      nmLogger.info('Renamed column successfully.');
                      
                      // alter table
                      table.alterType('new_column', 'map<blob,blob>', function(err) {
                        if (err) {
                          nmLogger.error('Error changing type of column: ' + err + '.');
                        }
                        else {
                          nmLogger.info('Changed type of column successfully.');
                          
                          // alter table
                          table.dropColumn('new_column', function(err) {
                            if (err) {
                              nmLogger.error('Error dropping column: ' + err + '.');
                            }
                            else {
                              nmLogger.info('Dropped column successfully.');
                              
                              // drop table
                              table.drop(function(err, result) {
                                if (err) {
                                  nmLogger.error('Error dropping table: ' + err + '.');
                                }
                                else {
                                  nmLogger.info('Dropped table successfully.');
                                }
                              });
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }, { ifNotExists: true });
    }
  }, { ifExists: true });
  
})(RUN_TESTS.tables);

// ==========
// = Models =
// ==========
(function(run) {
  if (!run) {
    return;
  }
  
  User.findOne({ id: nmDakota.generateUUID(), name: 'asdf' }, function(err, user) {
    if (err) {
      nmLogger.error('Error finding one: ' + err + '.');
    }
    else {
      nmLogger.info('Successfully called findOne');
      
      User.find({ id: nmDakota.generateUUID(), name: 'asdf' }, function(err, users) {
        if (err) {
          nmLogger.error('Error finding: ' + err + '.');
        }
        else {
          nmLogger.info('Successfully called find');
        }
      });
    }
  });
  
  for (var i = 0; i < 5; i++) {
    (function(i) {
      var user = new User({ id: nmDakota.generateUUID(), name: 'test name', loc: 'San Francisco', email: 'test@test.test' });
      user.save(function(err) {
        if (err) {
          nmLogger.error('Error creating user: ' + err + '.');
        }
        else {
          nmLogger.info('Created user ' + i + ' successfully.');
          
          if (i == 4) {
            
            // test method and static methods
            user.greet();
            User.greet();
            
            // count
            User.count(function(err, count){
              if (err) {
                nmLogger.error('Error counting users.');
              }
              else {
                nmLogger.info('Successfully counted users: ' + count);
              }
            });
            
            User.all(function(err, result) {
              if (err) {
                nmLogger.error('Error retrieving all users.');
              }
              else {
                nm_.each(result, function(u, index) {
                  if (!(u instanceof User)) {
                    nmLogger.error('Error result object not instance of User.');
                  }
                });
                nmLogger.info('Successfully retrieved all users: ' + result.length);
              }
            });
            
            // first
            User.first(function(err, result) {
              if (err) {
                nmLogger.error('Error retrieving first user.');
              }
              else {
                if (result && !(result instanceof User)) {
                  nmLogger.error('Error result object not instance of User.');
                }
                nmLogger.info('Successfully retrieved first user.');
                
                // each row
                User.where({ id: result.id, name: result.name }).allowFiltering(true).eachRow(
                  function(n, row) {
                    if (!(row instanceof User)) {
                      nmLogger.error('Error result object not instance of User.');
                    }
                    nmLogger.info('Retrieved row: ' + n);
                  },
                  function(err) {
                    if (err) {
                      nmLogger.error('Error retrieving all users by each row: ' + err + '.');
                    }
                    else {
                      nmLogger.info('Successfully retrieved users by each row.');
                      
                      // user
                      var user = new User({ id: nmDakota.generateUUID(), name: 'dakota user', loc: 'San Francisco', email: 'dakota@dakota.dakota' });
                      user.save(function(err) {
                        if (err) {
                          nmLogger.error('Error creating user: ' + err + '.');
                        }
                        else {
                          user.email = 'dakota@alexanderwong.me';
                          user.age = 17;
                          user.save(function(err) {
                            if (err) {
                              nmLogger.error('Error updating user: ' + err + '.');
                            }
                            else {
                              user.delete(function(err) {
                                if (err) {
                                  nmLogger.error('Error deleting user: ' + err + '.');
                                }
                                else {
                                  nmLogger.info('Successfully deleted user.');
                                  
                                  // delete all
                                  User.deleteAll(function(err) {
                                    if (err) {
                                      nmLogger.error('Error deleting all users: ' + err + '.');
                                    }
                                    else {
                                      nmLogger.info('Successfully deleted all users.');
                                    }
                                  });
                                }
                              });
                            }
                          });
                        }
                      });
                      
                    }
                  }
                );
              }
            });
          }
        }
      });
    })(i);
  }
  
})(RUN_TESTS.models);

// ===========
// = Queries =
// ===========
(function(run) {
  if (!run) {
    return;
  }
  
  // SELECT
  var query = new nmQuery(User);
  query = query.action('select').select('email', 'addresses').select(['ctime', 'utime']).where('name', 'Dakota').where({ loc: 'San Francisco', age: { '$gte' : 5 } }).orderBy('loc', '$asc').orderBy({ 'loc' : '$desc' }).limit(99).allowFiltering(true);
  nmLogger.info(query.build());

  // UPDATE
  query = new nmQuery(User);
  query = query.action('update').using('$ttl', 44300).using({'$timestamp':1337}).update('slug', 'some string').update({'age': 1337}).update({desc:{'$set' : 'i love dakota'}}).update({thngs:{'$prepend':'a', '$append' : 'b'}}).update({projs:{'$add':nmDakota.generateUUID()}}).where({name:'Dakota'}).if({age:{'$gte':5}}).ifExists(true);
  nmLogger.info(query.build());

  // INSERT
  query = new nmQuery(User);
  query = query.action('insert').insert('email', 'dakota@dakota.dakota').insert({'hash':{asd:'127.0.0.1'}, 'thngs':['1','2','3']}).ifNotExists(true).using('$ttl', 4430);
  nmLogger.info(query.build());

  // DELETE
  query = new nmQuery(User);
  query = query.action('delete').select('desc', 'age', 'tid').select(['ctime', 'utime']).where('name', 'Dakota').where({ loc: 'San Francisco', age: { '$gte' : 5 } }).using('$timestamp', 555);
  nmLogger.info(query.build());
  
})(RUN_TESTS.queries);

// ======================
// = User Defined Types =
// ======================
(function(run) {
  if (!run) {
    return;
  }
  
  var address = new nmUserDefinedType(dakota, 'address', require('./user_defined_types/address'), {});
  
  // create
  address.create(function(err, result) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      nmLogger.info('Successfully created type.');
      
      // add field
      address.addField('new_field', 'set<int>', function(err, result) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          nmLogger.info('Successfully added field to type.');
          
          // rename
          address.renameField('new_field', 'old_field', function(err, result) {
            if (err) {
              nmLogger.error(err);
            }
            else {
              nmLogger.info('Successfully renamed field in type.');
              
              // select schema
              address.selectSchema(function(err, result) {
                if (err) {
                  nmLogger.error(err);
                }
                else {
                  nmLogger.info('Successfully selected schema for type.');
                  
                  // delete, commented out becuase user schema relies on address
                  // address.drop(function(err, result) {
                  //   if (err) {
                  //     nmLogger.error(err);
                  //   }
                  //   else {
                  //     nmLogger.info('Successfully deleted type.');
                  //   }
                  // });
                }
              });
            }
          });
        }
      });
    }
  }, { ifNotExists: true });
  
})(RUN_TESTS.userDefinedTypes);

// =================
// = Complex Types =
// =================
(function(run) {
  if (!run) {
    return;
  }
  
  var user = new User({ name: 'Frank', email: 'dakota@dakota.dakota', loc: 'San Mateo' });
  var address = {
    street: '123 Main Street',
    city: 'San Francisco',
    state: 'California',
    zip: 92210,
    phones: ['(123) 456-7890', '(123) 456-7890'],
    tenants: { 101: 'Bob', 505: 'Mary' }
  };
  user.set({
    address: address,
    tuples: ['my tuple', 77, 'is the best tuple of them all'],
    nestedTuple: [['my tuple', 77, 'is the best tuple of them all'],['my tuple', 77, 'is the best tuple of them all']]
  });
  user.save(function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      nmLogger.info('Saved user successfully.');
      
      // retrieve
      User.first(function(err, result) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          nmLogger.info(result);
        }
      });
    }
  });
  
})(RUN_TESTS.complexTypes);

// =====================
// = Getter and Setter =
// =====================
(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Jose' }, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      user.exclamation = 'ahoy';
      nmLogger.info(user._get('exclamation'));
      nmLogger.info(user.exclamation);
    }
  });
  
})(RUN_TESTS.getterSetter);

// ===========
// = Counter =
// ===========
(function(run) {
  if (!run) {
    return;
  }
  
  var counter = new Counter({ name: nmDakota.generateUUID(), email: 'dakota@dakota.com', loc: 'SF' });
  counter.increment('num', 5);
  nmLogger.info(counter.changes('num'));
  counter.decrement('num', 4);
  nmLogger.info(counter.changes('num'));
  counter.decrement('num', 1);
  nmLogger.info(counter.changes('num'));
  counter.incrementNum(99);
  nmLogger.info(counter.changes('num'));
  counter.decrementNum(77);
  nmLogger.info(counter.changes('num'));
  counter.save(function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      nmLogger.info('Counter created successfully.');
    }
  });
  
})(RUN_TESTS.counter);

// ===============
// = Collections =
// ===============
(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco' }, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
      user.add('projs', nmDakota.generateTimeUUID());
      nmLogger.info(user.changes('projs'));
      var timeUUID = nmDakota.generateTimeUUID();
      user.add('projs', timeUUID);
      nmLogger.info(user.changes('projs'));
      user.add('projs', timeUUID);
      user.add('projs', timeUUID);
      user.add('projs', timeUUID);
      nmLogger.info(user.changes('projs'));
      user.set('projs', [timeUUID, timeUUID, timeUUID, timeUUID]);
      nmLogger.info(user.changes('projs'));
      user.remove('projs', timeUUID);
      nmLogger.info(user.changes('projs'));
      
      user.append('thngs', 'dog');
      nmLogger.info(user.changes('thngs'));
      user.append('thngs', 'cat');
      nmLogger.info(user.changes('thngs'));
      user.remove('thngs', 'dog');
      nmLogger.info(user.changes('thngs'));
      user.remove('thngs', 'cat');
      nmLogger.info(user.changes('thngs'));
      user.append('thngs', 'sheep');
      nmLogger.info(user.changes('thngs'));
      user.prepend('thngs', 'dragon');
      nmLogger.info(user.changes('thngs'));
      
      user.save(function(err) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          
          User.where({ id: user.id, name: user.name, loc: user.loc }).first(function(err, user) {
            if (err) {
              nmLogger.error(err);
            }
            else {
              
              nmLogger.info(user.projs);
            }
          });
        }
      });
    }
  });
  
})(RUN_TESTS.collections);

// ==========
// = Inject =
// ==========
(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', thngs: ['bird', 'aligator'] }, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
      user.injectThng(0, 'dog');
      user.injectThng(1, 'cat');
      user.injectHash('dog', '127.0.0.1');
      user.injectHash('feline', '255.255.255.255');
      
      user.save(function(err) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          
          User.where({ id: user.id, name: user.name, loc: user.loc }).first(function(err, user) {
            if (err) {
              nmLogger.error(err);
            }
            else {
              
              nmLogger.info(user.thngs);
              nmLogger.info(user.hash);
              
              var user = User.upsert({ id: user.id, name: user.name, loc: user.loc });
              user.injectThng(0, null);
              user.injectHash('dog', null);
              user.removeHash('feline');
              user.save(function(err) {
                if (err) {
                  nmLogger.error(err);
                }
                else {
                  
                  User.where({ id: user.id, name: user.name, loc: user.loc }).first(function(err, user) {
                    if (err) {
                      nmLogger.error(err);
                    }
                    else {
                      nmLogger.info(user.thngs);
                    }
                  });
                }
              });
              
            }
          });
        }
      });
    }
  });
  
})(RUN_TESTS.inject);

// ==========
// = Alias =
// ==========
(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', weight: 160.0 }, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
      nmLogger.info(user.weight);
      user.weight = 135.0;
      user.price = 1000000000;
      var uuid = nmDakota.generateUUID();
      user.friendUUIDs = [nmDakota.generateUUID(), uuid, nmDakota.generateUUID()];
      nmLogger.info(user.changes());
      user.addFriendUUID(nmDakota.generateUUID());
      user.removeFriendUUID(uuid);
      nmLogger.info(user.changes());
      
      user.save(function(err) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          
          User.where({ id: user.id, name: user.name, loc: user.loc }).first(function(err, user) {
            if (err) {
              nmLogger.error(err);
            }
            else {
              
              nmLogger.info(user.thngs);
              nmLogger.info(user.hash);
            }
          });
        }
      });
    }
  });
  
})(RUN_TESTS.alias);

// ====================
// = Instance Queries =
// ====================
(function(run) {
  if (!run) {
    return;
  }
  
  var params = { id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', weight: 160.0 };
  var user = User.create(params, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      user.ifExists(true).save(function(err) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          
          user.ifExists(true).delete(function(err) {
            if (err) {
              nmLogger.error(err);
            }
          });
          
        }
      });
    }
  });
  
  user = new User({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', weight: 160.0 });
  user.ttl(5).timestamp(1231231232).save(function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
    }
  });
  
  user = new User(params);
  user.ifNotExists(true).ttl(5).save(function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
    }
  });
  
})(RUN_TESTS.instanceQueries);

// ==================
// = Remove Map Key =
// ==================

(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', hash: { dog: '127.0.0.1', cat: '127.0.0.1' } }, function(err) {
    if (err) {
      nmLogger.error(err);
    }
    else {
      
      user.removeHash('dog');
      nmLogger.info(user.changes('hash'));
      user.removeHash('cat');
      nmLogger.info(user.changes('hash'));
      
      user.save(function(err) {
        if (err) {
          nmLogger.error(err);
        }
        else {
          
          nmLogger.info('User save successfully.');
          
          var user = User.create({ id: nmDakota.generateUUID(), name: 'asdf', email: 'dakota@dakota.com', loc: 'San Francisco', hash: { dog: '127.0.0.1', cat: '127.0.0.1' } }, function(err) {
            if (err) {
              nmLogger.error(err);
            }
            else {
              
              user.del = 5;
              user.removeHash('dog');
              user.injectHash('bird', '127.0.0.1');
              nmLogger.info(user.changes());
              
              user.save(function(err) {
                if (err) {
                  nmLogger.error(err);
                }
                else {
                  nmLogger.info('User save successfully.');
                }
              });
            }
          });
        }
      });
    }
  });
  
})(RUN_TESTS.removeMapKey);

// =================
// = Blind Updates =
// =================

(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.upsert({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco'});
  user.desc = 'QWERTY!';
  user.set({ sgn: new Date(), qty: 5.0, thngs: ['dog', 'cat', 'bird'], hash: { home: '127.0.0.1' }, address: { street: '123 Main Street', city: 'San Francisco' } });
  user.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('User blind update set field success.')
    }
  });
  
  user = User.upsert({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco'});
  user.injectHash('home', '127.0.0.1');
  user.addProj(nmDakota.generateTimeUUID());
  user.addProj(nmDakota.generateTimeUUID());
  user.prependThng('dog');
  user.removeAddress({ street: '123 Main Street', city: 'San Francisco' });
  user.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('User blind update collection specific operations success.')
    }
  });
  
})(RUN_TESTS.blindUpdates);

// =============================
// = Collection of Collections =
// =============================

(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.new({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco', email: 'asdf@asdf.com' });
  user.listOfLists = [['arff', 'howl']];
  nmLogger.info(user.changes());
  user.appendListOfList(['oink']);
  nmLogger.info(user.changes());
  user.prependListOfList(['moooo']);
  nmLogger.info(user.changes());
  user.removeListOfList(['oink']);
  nmLogger.info(user.changes());
  user.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('User collection of collections success.')
    }
  });
  
})(RUN_TESTS.collectionOfCollections);

// ================
// = DB Validator =
// ================

(function(run) {
  if (!run) {
    return;
  }
  
  nm_.each([
    'text',
    'map<text,int>',
    'set<map<text,map<text,int>>>',
    'set<frozen<map<text,frozen<map<text,int>>>>>',
    'list<frozen<tuple<text,int,text>>>',
    'frozen<address>',
    'list<frozen<address>>'
  ], function(type, index) {
    nmLogger.info(type);
    nmLogger.info(nmTypes.dbValidator(dakota, type));
  });
  
})(RUN_TESTS.dbValidator);

// ===============
// = Inject Null =
// ===============

(function(run) {
  if (!run) {
    return;
  }
  
  var user = User.new({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco', email: 'asdf@asdf.com', thngs: ['a', 'b', 'c', 'd', 'e', 'f'] });
  user.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('Remove and inject null:');
      user.removeThng('c');
      nmLogger.info(user.changes('thngs'));
      user.injectThng(1, null);
      nmLogger.info(user.changes('thngs'));
      
      user.save(function(err) {
        if (err) {
          nmLogger.warn(err);
        }
        else {
          nmLogger.info('Remove and inject null successful.');
        }
      });
    }
  });
  
  var user2 = User.new({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco', email: 'asdf@asdf.com', thngs: ['a', 'b', 'c', 'd', 'e', 'f'], hash: { home: '127.0.0.1', work: '127.0.0.1' } });
  user2.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('Inject null:')
      user2.injectThng(1, null);
      nmLogger.info(user2.changes('thngs'));
      user2.injectHash('work', null);
      nmLogger.info(user2.changes('hash'));
      user2.removeHash('home');
      nmLogger.info(user2.changes('hash'));
      
      user2.save(function(err) {
        if (err) {
          nmLogger.warn(err);
        }
        else {
          nmLogger.info('Inject null successful.');
        }
      });
    }
  });
  
  var user3 = User.new({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco', email: 'asdf@asdf.com' });
  user3.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('Remove when empty:')
      // user.injectThng(1, null);
      // nmLogger.info(user.changes('thngs'));
      user3.injectHash('work', null);
      nmLogger.info(user3.changes('hash'));
      user3.removeHash('home');
      nmLogger.info(user3.changes('hash'));
      
      user3.save(function(err) {
        if (err) {
          nmLogger.warn(err);
        }
        else {
          nmLogger.info('Remove when empty successful.');
        }
      });
    }
  });
  
  var user4 = User.upsert({ id: nmDakota.generateUUID(), name: 'asdf', loc: 'San Francisco', email: 'asdf@asdf.com' });
  nmLogger.info('Blind update remove when empty:')
  user4.injectHash('work', null);
  nmLogger.info(user4.changes('hash'));
  user4.removeHash('home');
  nmLogger.info(user4.changes('hash'));
  user4.save(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
    else {
      nmLogger.info('Blind update remove when empty successful.');
    }
  });
  
})(RUN_TESTS.injectNull);

// ====================
// = Delete Callbacks =
// ====================

(function(run) {
  if (!run) {
    return;
  }
  
  nmLogger.info('Delete with no callbacks');
  User.where({ id: nmDakota.generateUUID(), name: 'no callbacks', loc: 'San Francisco'}).ifExists(true).delete(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
  });
  
  nmLogger.info('Delete with callbacks');
  var user = User.upsert({ id: nmDakota.generateUUID(), name: 'with callbacks', loc: 'San Francisco'});
  user.delete(function(err) {
    if (err) {
      nmLogger.warn(err);
    }
  });
  
})(RUN_TESTS.deleteCallbacks);

// ===========
// = Streams =
// ===========

(function(run) {
  if (!run) {
    return;
  }
  
  var stream = User.stream()
  .on('readable', function () {
    //readable is emitted as soon a row is received and parsed
    var user;
    while (user = this.read()) {
      // nmLogger.info('read user: ' + JSON.stringify(user));
      nmLogger.info(user instanceof User);
    }
  })
  .on('end', function () {
    //stream ended, there aren't any more rows
    nmLogger.info('stream ended');
  })
  .on('error', function (err) {
    //Something went wrong: err is a response error from Cassandra
    nmLogger.warn('stream error');
    nmLogger.warn(err);
  });
  
})(RUN_TESTS.streams);

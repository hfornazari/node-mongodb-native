import { emitDeprecatedOptionWarning } from './utils';
import { PromiseProvider } from './promise_provider';
import { ReadPreference } from './read_preference';
import { deprecate } from 'util';
import {
  normalizeHintField,
  decorateCommand,
  decorateWithCollation,
  decorateWithReadConcern,
  formattedOrderClause,
  checkCollectionName,
  deprecateOptions,
  MongoDBNamespace
} from './utils';
import { ObjectId } from './bson';
import { MongoError } from './error';
import { initializeUnorderedBulkOp as unordered } from './bulk/unordered';
import { initializeOrderedBulkOp as ordered } from './bulk/ordered';
import { ChangeStream } from './change_stream';
import { WriteConcern } from './write_concern';
import { ReadConcern } from './read_concern';
import { AggregationCursor, CommandCursor } from './cursor';
import { AggregateOperation } from './operations/aggregate';
import { BulkWriteOperation } from './operations/bulk_write';
import { CountDocumentsOperation } from './operations/count_documents';
import {
  CreateIndexesOperation,
  CreateIndexOperation,
  DropIndexOperation,
  DropIndexesOperation,
  EnsureIndexOperation,
  IndexesOperation,
  IndexExistsOperation,
  IndexInformationOperation,
  ListIndexesOperation
} from './operations/indexes';
import { DistinctOperation } from './operations/distinct';
import { DropCollectionOperation } from './operations/drop';
import { EstimatedDocumentCountOperation } from './operations/estimated_document_count';
import { FindOperation } from './operations/find';
import { FindOneOperation } from './operations/find_one';
import {
  FindAndModifyOperation,
  FindOneAndDeleteOperation,
  FindOneAndReplaceOperation,
  FindOneAndUpdateOperation
} from './operations/find_and_modify';
import { InsertManyOperation } from './operations/insert_many';
import { InsertOneOperation } from './operations/insert';
import { UpdateOneOperation, UpdateManyOperation } from './operations/update';
import { DeleteOneOperation, DeleteManyOperation } from './operations/delete';
import { IsCappedOperation } from './operations/is_capped';
import { MapReduceOperation } from './operations/map_reduce';
import { OptionsOperation } from './operations/options_operation';
import { RenameOperation } from './operations/rename';
import { ReplaceOneOperation } from './operations/replace_one';
import { CollStatsOperation } from './operations/stats';
import { executeOperation } from './operations/execute_operation';
import { EvalGroupOperation, GroupOperation } from './operations/group';
import type { Callback } from './types';
const mergeKeys = ['ignoreUndefined'];

export interface Collection {
  find(query: any, options: any): void;
  insert(docs: any, options: any, callback: any): void;
  update(selector: any, update: any, options: any, callback: any): void;
  remove(selector: any, options: any, callback: any): void;
  findOne(query: any, options: any, callback: any): void;
  dropAllIndexes(): void;
  ensureIndex(fieldOrSpec: any, options: any, callback: any): void;
  count(query: any, options: any, callback: any): void;
  findAndRemove(query: any, sort: any, options: any, callback: any): void;
  group(
    keys: any,
    condition: any,
    initial: any,
    reduce: any,
    finalize: any,
    command: any,
    options: any,
    callback: any
  ): void;
  removeMany(filter: object, options?: any, callback?: Callback): Promise<void> | void;
  removeOne(filter: object, options?: any, callback?: Callback): Promise<void> | void;
  findAndModify(this: any, query: any, sort: any, doc: any, options: any, callback: Callback): any;
  _findAndModify(this: any, query: any, sort: any, doc: any, options: any, callback: Callback): any;
}

/**
 * The **Collection** class is an internal class that embodies a MongoDB collection
 * allowing for insert/update/remove/find and other command operation on that MongoDB collection.
 *
 * **COLLECTION Cannot directly be instantiated**
 *
 * @example
 * const MongoClient = require('mongodb').MongoClient;
 * const test = require('assert');
 * // Connection url
 * const url = 'mongodb://localhost:27017';
 * // Database Name
 * const dbName = 'test';
 * // Connect using MongoClient
 * MongoClient.connect(url, function(err, client) {
 *   // Create a collection we want to drop later
 *   const col = client.db(dbName).collection('createIndexExample1');
 *   // Show that duplicate records got dropped
 *   col.find({}).toArray(function(err, items) {
 *     test.equal(null, err);
 *     test.equal(4, items.length);
 *     client.close();
 *   });
 * });
 */
export class Collection {
  s: any;

  /**
   * Create a new Collection instance (INTERNAL TYPE, do not instantiate directly)
   *
   * @class
   * @param {any} db
   * @param {any} topology
   * @param {any} dbName
   * @param {any} name
   * @param {any} pkFactory
   * @param {any} options
   */
  constructor(db: any, topology: any, dbName: any, name: any, pkFactory: any, options: any) {
    checkCollectionName(name);
    emitDeprecatedOptionWarning(options, ['promiseLibrary']);

    // Unpack variables
    const internalHint = null;
    const slaveOk = options == null || options.slaveOk == null ? db.slaveOk : options.slaveOk;
    const serializeFunctions =
      options == null || options.serializeFunctions == null
        ? db.s.options.serializeFunctions
        : options.serializeFunctions;
    const raw = options == null || options.raw == null ? db.s.options.raw : options.raw;
    const promoteLongs =
      options == null || options.promoteLongs == null
        ? db.s.options.promoteLongs
        : options.promoteLongs;
    const promoteValues =
      options == null || options.promoteValues == null
        ? db.s.options.promoteValues
        : options.promoteValues;
    const promoteBuffers =
      options == null || options.promoteBuffers == null
        ? db.s.options.promoteBuffers
        : options.promoteBuffers;
    const collectionHint = null;

    const namespace = new MongoDBNamespace(dbName, name);

    // Set custom primary key factory if provided
    pkFactory = pkFactory == null ? ObjectId : pkFactory;

    // Internal state
    this.s = {
      // Set custom primary key factory if provided
      pkFactory,
      // Db
      db,
      // Topology
      topology,
      // Options
      options,
      // Namespace
      namespace,
      // Read preference
      readPreference: ReadPreference.fromOptions(options),
      // SlaveOK
      slaveOk,
      // Serialize functions
      serializeFunctions,
      // Raw
      raw,
      // promoteLongs
      promoteLongs,
      // promoteValues
      promoteValues,
      // promoteBuffers
      promoteBuffers,
      // internalHint
      internalHint,
      // collectionHint
      collectionHint,
      // Read Concern
      readConcern: ReadConcern.fromOptions(options),
      // Write Concern
      writeConcern: WriteConcern.fromOptions(options)
    };
  }

  /**
   * The name of the database this collection belongs to
   *
   * @member {string} dbName
   * @memberof Collection#
   * @readonly
   */
  get dbName(): string {
    return this.s.namespace.db;
  }

  /**
   * The name of this collection
   *
   * @member {string} collectionName
   * @memberof Collection#
   * @readonly
   */
  get collectionName(): string {
    return this.s.namespace.collection;
  }

  /**
   * The namespace of this collection, in the format `${this.dbName}.${this.collectionName}`
   *
   * @member {string} namespace
   * @memberof Collection#
   * @readonly
   */
  get namespace() {
    return this.s.namespace.toString();
  }

  /**
   * The current readConcern of the collection. If not explicitly defined for
   * this collection, will be inherited from the parent DB
   *
   * @member {ReadConcern} [readConcern]
   * @memberof Collection#
   * @readonly
   */
  get readConcern() {
    if (this.s.readConcern == null) {
      return this.s.db.readConcern;
    }
    return this.s.readConcern;
  }

  /**
   * The current readPreference of the collection. If not explicitly defined for
   * this collection, will be inherited from the parent DB
   *
   * @member {ReadPreference} [readPreference]
   * @memberof Collection#
   * @readonly
   */
  get readPreference() {
    if (this.s.readPreference == null) {
      return this.s.db.readPreference;
    }

    return this.s.readPreference;
  }

  /**
   * The current writeConcern of the collection. If not explicitly defined for
   * this collection, will be inherited from the parent DB
   *
   * @member {WriteConcern} [writeConcern]
   * @memberof Collection#
   * @readonly
   */
  get writeConcern() {
    if (this.s.writeConcern == null) {
      return this.s.db.writeConcern;
    }
    return this.s.writeConcern;
  }

  /**
   * The current index hint for the collection
   *
   * @member {object} [hint]
   * @memberof Collection#
   */
  get hint() {
    return this.s.collectionHint;
  }

  set hint(v: any) {
    this.s.collectionHint = normalizeHintField(v);
  }

  /**
   * Inserts a single document into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @function
   * @param {object} doc Document to insert.
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {boolean} [options.forceServerObjectId=false] Force server to assign _id values instead of driver.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=true] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~insertOneWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  insertOne(doc: object, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(this.s.topology, new InsertOneOperation(this, doc, options), callback);
  }

  /**
   * Inserts an array of documents into MongoDB. If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @function
   * @param {object[]} docs Documents to insert.
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {boolean} [options.ordered=true] If true, when an insert fails, don't execute the remaining writes. If false, continue with remaining inserts when one fails.
   * @param {boolean} [options.forceServerObjectId=false] Force server to assign _id values instead of driver.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=true] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~insertWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  insertMany(docs: any, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options ? Object.assign({}, options) : { ordered: true };

    return executeOperation(
      this.s.topology,
      new InsertManyOperation(this, docs, options),
      callback
    );
  }

  /**
   * @typedef {object} Collection~BulkWriteOpResult
   * @property {number} insertedCount Number of documents inserted.
   * @property {number} matchedCount Number of documents matched for update.
   * @property {number} modifiedCount Number of documents modified.
   * @property {number} deletedCount Number of documents deleted.
   * @property {number} upsertedCount Number of documents upserted.
   * @property {object} insertedIds Inserted document generated Id's, hash key is the index of the originating operation
   * @property {object} upsertedIds Upserted document generated Id's, hash key is the index of the originating operation
   * @property {object} result The command result object.
   */

  /**
   * The callback format for inserts
   *
   * @callback Collection~bulkWriteOpCallback
   * @param {BulkWriteError} error An error instance representing the error during the execution.
   * @param {Collection~BulkWriteOpResult} result The result object if the command was executed successfully.
   */

  /**
   * Perform a bulkWrite operation without a fluent API
   *
   * Legal operation types are
   *
   *  { insertOne: { document: { a: 1 } } }
   *
   *  { updateOne: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
   *
   *  { updateMany: { filter: {a:2}, update: {$set: {a:2}}, upsert:true } }
   *
   *  { updateMany: { filter: {}, update: {$set: {"a.$[i].x": 5}}, arrayFilters: [{ "i.x": 5 }]} }
   *
   *  { deleteOne: { filter: {c:1} } }
   *
   *  { deleteMany: { filter: {c:1} } }
   *
   *  { replaceOne: { filter: {c:3}, replacement: {c:4}, upsert:true}}
   *
   * If documents passed in do not contain the **_id** field,
   * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
   * can be overridden by setting the **forceServerObjectId** flag.
   *
   * @function
   * @param {object[]} operations Bulk operations to perform.
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.ordered=true] Execute write operation in ordered or unordered fashion.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object[]} [options.arrayFilters] Determines which array elements to modify for update operation in MongoDB 3.6 or higher.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~bulkWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  bulkWrite(operations: any, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || { ordered: true };

    if (!Array.isArray(operations)) {
      throw MongoError.create({
        message: 'operations must be an array of documents',
        driver: true
      });
    }

    return executeOperation(
      this.s.topology,
      new BulkWriteOperation(this, operations, options),
      callback
    );
  }

  /**
   * @typedef {object} Collection~updateWriteOpResult
   * @property {object} result The raw result returned from MongoDB. Will vary depending on server version.
   * @property {number} result.ok Is 1 if the command executed correctly.
   * @property {number} result.n The total count of documents scanned.
   * @property {number} result.nModified The total count of documents modified.
   * @property {object} connection The connection object used for the operation.
   * @property {number} matchedCount The number of documents that matched the filter.
   * @property {number} modifiedCount The number of documents that were modified.
   * @property {number} upsertedCount The number of documents upserted.
   * @property {object} upsertedId The upserted id.
   * @property {ObjectId} upsertedId._id The upserted _id returned from the server.
   * @property {object} message The raw msg response wrapped in an internal class
   * @property {object[]} [ops] In a response to {@link Collection#replaceOne replaceOne}, contains the new value of the document on the server. This is the same document that was originally passed in, and is only here for legacy purposes.
   */

  /**
   * The callback format for inserts
   *
   * @callback Collection~updateWriteOpCallback
   * @param {MongoError} error An error instance representing the error during the execution.
   * @param {Collection~updateWriteOpResult} result The result object if the command was executed successfully.
   */

  /**
   * Update a single document in a collection
   *
   * @function
   * @param {object} filter The Filter used to select the document to update
   * @param {object} update The update operations to be applied to the document
   * @param {object} [options] Optional settings.
   * @param {Array} [options.arrayFilters] optional list of array filters referenced in filtered positional operators
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {object} [options.hint] An optional hint for query optimization. See the {@link https://docs.mongodb.com/manual/reference/command/update/#update-command-hint|update command} reference for more information.
   * @param {boolean} [options.upsert=false] When true, creates a new document if no document matches the query..
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~updateWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  updateOne(
    filter: object,
    update: object,
    options?: any,
    callback?: Callback
  ): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = Object.assign({}, options);

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(
      this.s.topology,
      new UpdateOneOperation(this, filter, update, options),
      callback
    );
  }

  /**
   * Replace a document in a collection with another document
   *
   * @function
   * @param {object} filter The Filter used to select the document to replace
   * @param {object} doc The Document that replaces the matching document
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {object} [options.hint] An optional hint for query optimization. See the {@link https://docs.mongodb.com/manual/reference/command/update/#update-command-hint|update command} reference for more information.
   * @param {boolean} [options.upsert=false] When true, creates a new document if no document matches the query.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~updateWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void<Collection~updateWriteOpResult>} returns Promise if no callback passed
   */
  replaceOne(
    filter: object,
    doc: object,
    options?: any,
    callback?: Callback
  ): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = Object.assign({}, options);

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(
      this.s.topology,
      new ReplaceOneOperation(this, filter, doc, options),
      callback
    );
  }

  /**
   * Update multiple documents in a collection
   *
   * @function
   * @param {object} filter The Filter used to select the documents to update
   * @param {object} update The update operations to be applied to the documents
   * @param {object} [options] Optional settings.
   * @param {Array} [options.arrayFilters] optional list of array filters referenced in filtered positional operators
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {object} [options.hint] An optional hint for query optimization. See the {@link https://docs.mongodb.com/manual/reference/command/update/#update-command-hint|update command} reference for more information.
   * @param {boolean} [options.upsert=false] When true, creates a new document if no document matches the query..
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~updateWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void<Collection~updateWriteOpResult>} returns Promise if no callback passed
   */
  updateMany(
    filter: object,
    update: object,
    options?: any,
    callback?: Callback
  ): Promise<void> | void {
    const Promise = PromiseProvider.get();
    if (typeof options === 'function') (callback = options), (options = {});
    options = Object.assign({}, options);

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(
      this.s.topology,
      new UpdateManyOperation(this, filter, update, options),
      callback
    );
  }

  /**
   * @typedef {object} Collection~deleteWriteOpResult
   * @property {object} result The raw result returned from MongoDB. Will vary depending on server version.
   * @property {number} result.ok Is 1 if the command executed correctly.
   * @property {number} result.n The total count of documents deleted.
   * @property {object} connection The connection object used for the operation.
   * @property {number} deletedCount The number of documents deleted.
   */

  /**
   * The callback format for deletes
   *
   * @callback Collection~deleteWriteOpCallback
   * @param {MongoError} error An error instance representing the error during the execution.
   * @param {Collection~deleteWriteOpResult} result The result object if the command was executed successfully.
   */

  /**
   * Delete a document from a collection
   *
   * @function
   * @param {object} filter The Filter used to select the document to remove
   * @param {object} [options] Optional settings.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {string|object} [options.hint] optional index hint for optimizing the filter query
   * @param {Collection~deleteWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  deleteOne(filter: object, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = Object.assign({}, options);

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(
      this.s.topology,
      new DeleteOneOperation(this, filter, options),
      callback
    );
  }

  /**
   * Delete multiple documents from a collection
   *
   * @function
   * @param {object} filter The Filter used to select the documents to remove
   * @param {object} [options] Optional settings.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {string|object} [options.hint] optional index hint for optimizing the filter query
   * @param {Collection~deleteWriteOpCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  deleteMany(filter: object, options?: any, callback?: Callback): Promise<void> | void {
    if (filter == null) {
      filter = {};
      options = {};
      callback = undefined;
    } else if (typeof filter === 'function') {
      callback = filter as Callback;
      filter = {};
      options = {};
    } else if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    options = Object.assign({}, options);

    // Add ignoreUndefined
    if (this.s.options.ignoreUndefined) {
      options = Object.assign({}, options);
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return executeOperation(
      this.s.topology,
      new DeleteManyOperation(this, filter, options),
      callback
    );
  }

  /**
   * The callback format for the collection method, must be used if strict is specified
   *
   * @callback Collection~collectionResultCallback
   * @param {MongoError} error An error instance representing the error during the execution.
   * @param {Collection} collection The collection instance.
   */

  /**
   * Rename the collection.
   *
   * @function
   * @param {string} newName New name of of the collection.
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.dropTarget=false] Drop the target name collection if it previously exists.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~collectionResultCallback} [callback] The results callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  rename(newName: string, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = Object.assign({}, options, { readPreference: ReadPreference.PRIMARY });

    return executeOperation(this.s.topology, new RenameOperation(this, newName, options), callback);
  }

  /**
   * Drop the collection from the database, removing it permanently. New accesses will create a new collection.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {WriteConcern} [options.writeConcern] A full WriteConcern object
   * @param {(number|string)} [options.w] The write concern
   * @param {number} [options.wtimeout] The write concern timeout
   * @param {boolean} [options.j] The journal write concern
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The results callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  drop(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new DropCollectionOperation(this.s.db, this.collectionName, options),
      callback
    );
  }

  /**
   * Returns the options of the collection.
   *
   * @function
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The results callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  options(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(this.s.topology, new OptionsOperation(this, options), callback);
  }

  /**
   * Returns if the collection is a capped collection
   *
   * @function
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The results callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  isCapped(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(this.s.topology, new IsCappedOperation(this, options), callback);
  }

  /**
   * Creates an index on the db and collection collection.
   *
   * @function
   * @param {(string|Array|object)} fieldOrSpec Defines the index.
   * @param {object} [options] Optional settings.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.unique=false] Creates an unique index.
   * @param {boolean} [options.sparse=false] Creates a sparse index.
   * @param {boolean} [options.background=false] Creates the index in the background, yielding whenever possible.
   * @param {boolean} [options.dropDups=false] A unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
   * @param {number} [options.min] For geospatial indexes set the lower bound for the co-ordinates.
   * @param {number} [options.max] For geospatial indexes set the high bound for the co-ordinates.
   * @param {number} [options.v] Specify the format version of the indexes.
   * @param {number} [options.expireAfterSeconds] Allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
   * @param {string} [options.name] Override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
   * @param {object} [options.partialFilterExpression] Creates a partial index based on the given filter object (MongoDB 3.2 or higher)
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {(number|string)} [options.commitQuorum] (MongoDB 4.4. or higher) Specifies how many data-bearing members of a replica set, including the primary, must complete the index builds successfully before the primary marks the indexes as ready. This option accepts the same values for the "w" field in a write concern plus "votingMembers", which indicates all voting data-bearing nodes.
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   * @example
   * const collection = client.db('foo').collection('bar');
   *
   * await collection.createIndex({ a: 1, b: -1 });
   *
   * // Alternate syntax for { c: 1, d: -1 } that ensures order of indexes
   * await collection.createIndex([ [c, 1], [d, -1] ]);
   *
   * // Equivalent to { e: 1 }
   * await collection.createIndex('e');
   *
   * // Equivalent to { f: 1, g: 1 }
   * await collection.createIndex(['f', 'g'])
   *
   * // Equivalent to { h: 1, i: -1 }
   * await collection.createIndex([ { h: 1 }, { i: -1 } ]);
   *
   * // Equivalent to { j: 1, k: -1, l: 2d }
   * await collection.createIndex(['j', ['k', -1], { l: '2d' }])
   */
  createIndex(fieldOrSpec: any, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new CreateIndexOperation(this, this.collectionName, fieldOrSpec, options),
      callback
    );
  }

  /**
   * Creates multiple indexes in the collection, this method is only supported for
   * MongoDB 2.6 or higher. Earlier version of MongoDB will throw a command not supported
   * error.
   *
   * **Note**: Unlike {@link Collection#createIndex createIndex}, this function takes in raw index specifications.
   * Index specifications are defined {@link http://docs.mongodb.org/manual/reference/command/createIndexes/ here}.
   *
   * @function
   * @param {Collection~IndexDefinition[]} indexSpecs An array of index specifications to be created
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {(number|string)} [options.commitQuorum] (MongoDB 4.4. or higher) Specifies how many data-bearing members of a replica set, including the primary, must complete the index builds successfully before the primary marks the indexes as ready. This option accepts the same values for the "w" field in a write concern plus "votingMembers", which indicates all voting data-bearing nodes.
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   * @example
   * const collection = client.db('foo').collection('bar');
   * await collection.createIndexes([
   *   // Simple index on field fizz
   *   {
   *     key: { fizz: 1 },
   *   }
   *   // wildcard index
   *   {
   *     key: { '$**': 1 }
   *   },
   *   // named index on darmok and jalad
   *   {
   *     key: { darmok: 1, jalad: -1 }
   *     name: 'tanagra'
   *   }
   * ]);
   */
  createIndexes(indexSpecs: any, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options ? Object.assign({}, options) : {};
    if (typeof options.maxTimeMS !== 'number') delete options.maxTimeMS;

    return executeOperation(
      this.s.topology,
      new CreateIndexesOperation(this, this.collectionName, indexSpecs, options),
      callback
    );
  }

  /**
   * Drops an index from this collection.
   *
   * @function
   * @param {string} indexName Name of the index to drop.
   * @param {object} [options] Optional settings.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  dropIndex(indexName: string, options?: any, callback?: Callback): Promise<void> | void {
    const args = Array.prototype.slice.call(arguments, 1);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    options = args.length ? args.shift() || {} : {};

    // Run only against primary
    options.readPreference = ReadPreference.PRIMARY;

    return executeOperation(
      this.s.topology,
      new DropIndexOperation(this, indexName, options),
      callback
    );
  }

  /**
   * Drops all indexes from this collection.
   *
   * @function
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  dropIndexes(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options ? Object.assign({}, options) : {};
    if (typeof options.maxTimeMS !== 'number') delete options.maxTimeMS;

    return executeOperation(this.s.topology, new DropIndexesOperation(this, options), callback);
  }

  /**
   * Get the list of all indexes information for the collection.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {number} [options.batchSize=1000] The batchSize for the returned command cursor or if pre 2.8 the systems batch collection
   * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @returns {CommandCursor}
   */
  listIndexes(options?: any): CommandCursor {
    const cursor = new CommandCursor(
      this.s.topology,
      new ListIndexesOperation(this, options),
      options
    );

    return cursor;
  }

  /**
   * Checks if one or more indexes exist on the collection, fails on first non-existing index
   *
   * @function
   * @param {(string|Array)} indexes One or more index names to check.
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  indexExists(indexes: any, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new IndexExistsOperation(this, indexes, options),
      callback
    );
  }

  /**
   * Retrieves this collections index info.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.full=false] Returns the full raw index information.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  indexInformation(options?: any, callback?: Callback): Promise<void> | void {
    const args = Array.prototype.slice.call(arguments, 0);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    options = args.length ? args.shift() || {} : {};

    return executeOperation(
      this.s.topology,
      new IndexInformationOperation(this.s.db, this.collectionName, options),
      callback
    );
  }

  /**
   * Gets an estimate of the count of documents in a collection using collection metadata.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {number} [options.maxTimeMS] The maximum amount of time to allow the operation to run.
   * @param {Collection~countCallback} [callback] The command result callback.
   * @returns {Promise<void> | void} returns Promise if no callback passed.
   */
  estimatedDocumentCount(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new EstimatedDocumentCountOperation(this, options),
      callback
    );
  }

  /**
   * Gets the number of documents matching the filter.
   * For a fast count of the total documents in a collection see {@link Collection#estimatedDocumentCount estimatedDocumentCount}.
   * **Note**: When migrating from {@link Collection#count count} to {@link Collection#countDocuments countDocuments}
   * the following query operators must be replaced:
   *
   * | Operator | Replacement |
   * | -------- | ----------- |
   * | `$where`   | [`$expr`][1] |
   * | `$near`    | [`$geoWithin`][2] with [`$center`][3] |
   * | `$nearSphere` | [`$geoWithin`][2] with [`$centerSphere`][4] |
   *
   * [1]: https://docs.mongodb.com/manual/reference/operator/query/expr/
   * [2]: https://docs.mongodb.com/manual/reference/operator/query/geoWithin/
   * [3]: https://docs.mongodb.com/manual/reference/operator/query/center/#op._S_center
   * [4]: https://docs.mongodb.com/manual/reference/operator/query/centerSphere/#op._S_centerSphere
   *
   * @param {object} [query] the query for the count
   * @param {object} [options] Optional settings.
   * @param {object} [options.collation] Specifies a collation.
   * @param {string|object} [options.hint] The index to use.
   * @param {number} [options.limit] The maximum number of document to count.
   * @param {number} [options.maxTimeMS] The maximum amount of time to allow the operation to run.
   * @param {number} [options.skip] The number of documents to skip before counting.
   * @param {Collection~countCallback} [callback] The command result callback.
   * @returns {Promise<void> | void} returns Promise if no callback passed.
   * @see https://docs.mongodb.com/manual/reference/operator/query/expr/
   * @see https://docs.mongodb.com/manual/reference/operator/query/geoWithin/
   * @see https://docs.mongodb.com/manual/reference/operator/query/center/#op._S_center
   * @see https://docs.mongodb.com/manual/reference/operator/query/centerSphere/#op._S_centerSphere
   */

  countDocuments(query: any, options: any, callback: Callback) {
    const args = Array.prototype.slice.call(arguments, 0);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    query = args.length ? args.shift() || {} : {};
    options = args.length ? args.shift() || {} : {};

    return executeOperation(
      this.s.topology,
      new CountDocumentsOperation(this, query, options),
      callback
    );
  }

  /**
   * The distinct command returns a list of distinct values for the given key across a collection.
   *
   * @function
   * @param {string} key Field of the document to find distinct values for.
   * @param {object} [query] The query for filtering the set of documents to which we apply the distinct filter.
   * @param {object} [options] Optional settings.
   * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
   * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
   * @param {object} [options.collation] Specify collation settings for operation. See {@link https://docs.mongodb.com/manual/reference/command/aggregate|aggregation documentation}.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  distinct(key: string, query?: object, options?: any, callback?: Callback): Promise<void> | void {
    const args = Array.prototype.slice.call(arguments, 1);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    const queryOption = args.length ? args.shift() || {} : {};
    const optionsOption = args.length ? args.shift() || {} : {};

    return executeOperation(
      this.s.topology,
      new DistinctOperation(this, key, queryOption, optionsOption),
      callback
    );
  }

  /**
   * Retrieve all the indexes on the collection.
   *
   * @function
   * @param {object} [options] Optional settings
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The command result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  indexes(options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(this.s.topology, new IndexesOperation(this, options), callback);
  }

  /**
   * Get all the collection statistics.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {number} [options.scale] Divide the returned sizes by scale value.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The collection result callback
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  stats(options?: any, callback?: Callback): Promise<void> | void {
    const args = Array.prototype.slice.call(arguments, 0);
    callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    options = args.length ? args.shift() || {} : {};

    return executeOperation(this.s.topology, new CollStatsOperation(this, options), callback);
  }

  /**
   * @typedef {object} Collection~findAndModifyWriteOpResult
   * @property {object} value Document returned from the `findAndModify` command. If no documents were found, `value` will be `null` by default (`returnOriginal: true`), even if a document was upserted; if `returnOriginal` was false, the upserted document will be returned in that case.
   * @property {object} lastErrorObject The raw lastErrorObject returned from the command. See {@link https://docs.mongodb.com/manual/reference/command/findAndModify/index.html#lasterrorobject|findAndModify command documentation}.
   * @property {number} ok Is 1 if the command executed correctly.
   */

  /**
   * The callback format for inserts
   *
   * @callback Collection~findAndModifyCallback
   * @param {MongoError} error An error instance representing the error during the execution.
   * @param {Collection~findAndModifyWriteOpResult} result The result object if the command was executed successfully.
   */

  /**
   * Find a document and delete it in one atomic operation. Requires a write lock for the duration of the operation.
   *
   * @function
   * @param {object} filter The Filter used to select the document to remove
   * @param {object} [options] Optional settings.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {object} [options.projection] Limits the fields to return for all matching documents.
   * @param {object} [options.sort] Determines which document the operation modifies if the query selects multiple documents.
   * @param {number} [options.maxTimeMS] The maximum amount of time to allow the query to run.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~findAndModifyCallback} [callback] The collection result callback
   * @returns {Promise<void> | void<Collection~findAndModifyWriteOpResultObject>} returns Promise if no callback passed
   */
  findOneAndDelete(filter: object, options?: any, callback?: Callback): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new FindOneAndDeleteOperation(this, filter, options),
      callback
    );
  }

  /**
   * Find a document and replace it in one atomic operation. Requires a write lock for the duration of the operation.
   *
   * @function
   * @param {object} filter The Filter used to select the document to replace
   * @param {object} replacement The Document that replaces the matching document
   * @param {object} [options] Optional settings.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {string|object} [options.hint] An optional index to use for this operation
   * @param {number} [options.maxTimeMS] The maximum amount of time to allow the query to run.
   * @param {object} [options.projection] Limits the fields to return for all matching documents.
   * @param {object} [options.sort] Determines which document the operation modifies if the query selects multiple documents.
   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~findAndModifyCallback} [callback] The collection result callback
   * @returns {Promise<void> | void<Collection~findAndModifyWriteOpResultObject>} returns Promise if no callback passed
   */
  findOneAndReplace(
    filter: object,
    replacement: object,
    options?: any,
    callback?: Callback
  ): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new FindOneAndReplaceOperation(this, filter, replacement, options),
      callback
    );
  }

  /**
   * Find a document and update it in one atomic operation. Requires a write lock for the duration of the operation.
   *
   * @function
   * @param {object} filter The Filter used to select the document to update
   * @param {object} update Update operations to be performed on the document
   * @param {object} [options] Optional settings.
   * @param {Array} [options.arrayFilters] optional list of array filters referenced in filtered positional operators
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {string|object} [options.hint] An optional index to use for this operation
   * @param {number} [options.maxTimeMS] The maximum amount of time to allow the query to run.
   * @param {object} [options.projection] Limits the fields to return for all matching documents.
   * @param {object} [options.sort] Determines which document the operation modifies if the query selects multiple documents.
   * @param {boolean} [options.upsert=false] Upsert the document if it does not exist.
   * @param {boolean} [options.returnOriginal=true] When false, returns the updated document rather than the original. The default is true.
   * @param {boolean} [options.checkKeys=false] If true, will throw if bson documents start with `$` or include a `.` in any key value
   * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] An ptional session to use for this operation
   * @param {Collection~findAndModifyCallback} [callback] The collection result callback
   * @returns {Promise<void> | void<Collection~findAndModifyWriteOpResultObject>} returns Promise if no callback passed
   */
  findOneAndUpdate(
    filter: object,
    update: object,
    options?: any,
    callback?: Callback
  ): Promise<void> | void {
    if (typeof options === 'function') (callback = options), (options = {});
    options = options || {};

    return executeOperation(
      this.s.topology,
      new FindOneAndUpdateOperation(this, filter, update, options),
      callback
    );
  }

  /**
   * Execute an aggregation framework pipeline against the collection, needs MongoDB >= 2.2
   *
   * @function
   * @param {object} [pipeline=[]] Array containing all the aggregation framework commands for the execution.
   * @param {object} [options] Optional settings.
   * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
   * @param {number} [options.batchSize=1000] The number of documents to return per batch. See {@link https://docs.mongodb.com/manual/reference/command/aggregate|aggregation documentation}.
   * @param {object} [options.cursor] Return the query as cursor, on 2.6 > it returns as a real cursor on pre 2.6 it returns as an emulated cursor.
   * @param {number} [options.cursor.batchSize=1000] Deprecated. Use `options.batchSize`
   * @param {boolean} [options.explain=false] Explain returns the aggregation execution plan (requires mongodb 2.6 >).
   * @param {boolean} [options.allowDiskUse=false] allowDiskUse lets the server know if it can use disk to store temporary results for the aggregation (requires mongodb 2.6 >).
   * @param {number} [options.maxTimeMS] maxTimeMS specifies a cumulative time limit in milliseconds for processing operations on the cursor. MongoDB interrupts the operation at the earliest following interrupt point.
   * @param {number} [options.maxAwaitTimeMS] The maximum amount of time for the server to wait on new documents to satisfy a tailable cursor query.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {boolean} [options.raw=false] Return document results as raw BSON buffers.
   * @param {boolean} [options.promoteLongs=true] Promotes Long values to number if they fit inside the 53 bits resolution.
   * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
   * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
   * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
   * @param {string} [options.comment] Add a comment to an aggregation command
   * @param {string|object} [options.hint] Add an index selection hint to an aggregation command
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @returns {AggregationCursor}
   */
  aggregate(pipeline?: object, options?: any): AggregationCursor {
    if (arguments.length > 2) {
      throw new TypeError('Third parameter to `collection.aggregate()` must be undefined');
    }
    if (typeof pipeline === 'function') {
      throw new TypeError('`pipeline` parameter must not be function');
    }
    if (typeof options === 'function') {
      throw new TypeError('`options` parameter must not be function');
    }

    if (Array.isArray(pipeline)) {
      // If we have no options or callback we are doing
      // a cursor based aggregation
      if (options == null) {
        options = {};
      }
    } else {
      // Aggregation pipeline passed as arguments on the method
      const args = Array.prototype.slice.call(arguments, 0);
      // Get the possible options object
      const opts = args[args.length - 1];
      // If it contains any of the admissible options pop it of the args
      options =
        opts &&
        (opts.readPreference ||
          opts.explain ||
          opts.cursor ||
          opts.out ||
          opts.maxTimeMS ||
          opts.hint ||
          opts.allowDiskUse)
          ? args.pop()
          : {};
      // Left over arguments is the pipeline
      pipeline = args;
    }

    const cursor = new AggregationCursor(
      this.s.topology,
      new AggregateOperation(this, pipeline, options),
      options
    );

    return cursor;
  }

  /**
   * Create a new Change Stream, watching for new changes (insertions, updates, replacements, deletions, and invalidations) in this collection.
   *
   * @function
   * @since 3.0.0
   * @param {Array} [pipeline] An array of {@link https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/|aggregation pipeline stages} through which to pass change stream documents. This allows for filtering (using $match) and manipulating the change stream documents.
   * @param {object} [options] Optional settings
   * @param {string} [options.fullDocument='default'] Allowed values: ‘default’, ‘updateLookup’. When set to ‘updateLookup’, the change stream will include both a delta describing the changes to the document, as well as a copy of the entire document that was changed from some time after the change occurred.
   * @param {object} [options.resumeAfter] Specifies the logical starting point for the new change stream. This should be the _id field from a previously returned change stream document.
   * @param {number} [options.maxAwaitTimeMS] The maximum amount of time for the server to wait on new documents to satisfy a change stream query
   * @param {number} [options.batchSize=1000] The number of documents to return per batch. See {@link https://docs.mongodb.com/manual/reference/command/aggregate|aggregation documentation}.
   * @param {object} [options.collation] Specify collation settings for operation. See {@link https://docs.mongodb.com/manual/reference/command/aggregate|aggregation documentation}.
   * @param {ReadPreference} [options.readPreference] The read preference. Defaults to the read preference of the database or collection. See {@link https://docs.mongodb.com/manual/reference/read-preference|read preference documentation}.
   * @param {Timestamp} [options.startAtOperationTime] receive change events that occur after the specified timestamp
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @returns {ChangeStream} a ChangeStream instance.
   */
  watch(pipeline?: any[], options?: any): ChangeStream {
    pipeline = pipeline || [];
    options = options || {};

    // Allow optionally not specifying a pipeline
    if (!Array.isArray(pipeline)) {
      options = pipeline;
      pipeline = [];
    }

    return new ChangeStream(this, pipeline, options);
  }

  /**
   * Run Map Reduce across a collection. Be aware that the inline option for out will return an array of results not a collection.
   *
   * @function
   * @param {(Function|string)} map The mapping function.
   * @param {(Function|string)} reduce The reduce function.
   * @param {object} [options] Optional settings.
   * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
   * @param {object} [options.out] Sets the output target for the map reduce job. *{inline:1} | {replace:'collectionName'} | {merge:'collectionName'} | {reduce:'collectionName'}*
   * @param {object} [options.query] Query filter object.
   * @param {object} [options.sort] Sorts the input objects using this key. Useful for optimization, like sorting by the emit key for fewer reduces.
   * @param {number} [options.limit] Number of objects to return from collection.
   * @param {boolean} [options.keeptemp=false] Keep temporary data.
   * @param {(Function|string)} [options.finalize] Finalize function.
   * @param {object} [options.scope] Can pass in variables that can be access from map/reduce/finalize.
   * @param {boolean} [options.jsMode=false] It is possible to make the execution stay in JS. Provided in MongoDB > 2.0.X.
   * @param {boolean} [options.verbose=false] Provide statistics on job execution time.
   * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {Collection~resultCallback} [callback] The command result callback
   * @throws {MongoError}
   * @returns {Promise<void> | void} returns Promise if no callback passed
   */
  mapReduce(map: any, reduce: any, options?: any, callback?: Callback): Promise<void> | void {
    if ('function' === typeof options) (callback = options), (options = {});
    // Out must allways be defined (make sure we don't break weirdly on pre 1.8+ servers)
    if (null == options.out) {
      throw new Error(
        'the out option parameter must be defined, see mongodb docs for possible values'
      );
    }

    if ('function' === typeof map) {
      map = map.toString();
    }

    if ('function' === typeof reduce) {
      reduce = reduce.toString();
    }

    if ('function' === typeof options.finalize) {
      options.finalize = options.finalize.toString();
    }

    return executeOperation(
      this.s.topology,
      new MapReduceOperation(this, map, reduce, options),
      callback
    );
  }

  /**
   * Initiate an Out of order batch write operation. All operations will be buffered into insert/update/remove commands executed out of order.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @returns {UnorderedBulkOperation}
   */
  initializeUnorderedBulkOp(options?: any): any {
    options = options || {};
    // Give function's options precedence over session options.
    if (options.ignoreUndefined == null) {
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return unordered(this.s.topology, this, options);
  }

  /**
   * Initiate an In order bulk write operation. Operations will be serially executed in the order they are added, creating a new operation for each switch in types.
   *
   * @function
   * @param {object} [options] Optional settings.
   * @param {(number|string)} [options.w] The write concern.
   * @param {number} [options.wtimeout] The write concern timeout.
   * @param {boolean} [options.j=false] Specify a journal write concern.
   * @param {ClientSession} [options.session] optional session to use for this operation
   * @param {boolean} [options.ignoreUndefined=false] Specify if the BSON serializer should ignore undefined fields.
   * @returns {OrderedBulkOperation}
   */
  initializeOrderedBulkOp(options?: any): any {
    options = options || {};
    // Give function's options precedence over session's options.
    if (options.ignoreUndefined == null) {
      options.ignoreUndefined = this.s.options.ignoreUndefined;
    }

    return ordered(this.s.topology, this, options);
  }

  /**
   * Return the db logger
   *
   * @function
   * @returns {Logger} return the db logger
   */
  getLogger(): any {
    return this.s.db.s.logger;
  }
}

const DEPRECATED_FIND_OPTIONS = ['maxScan', 'fields', 'snapshot', 'oplogReplay'];

/**
 * Creates a cursor for a query that can be used to iterate over results from MongoDB
 *
 * @function
 * @param {object} [query={}] The cursor query object.
 * @param {object} [options] Optional settings.
 * @param {number} [options.limit=0] Sets the limit of documents returned in the query.
 * @param {(Array|object)} [options.sort] Set to sort the documents coming back from the query. Array of indexes, [['a', 1]] etc.
 * @param {object} [options.projection] The fields to return in the query. Object of fields to either include or exclude (one of, not both), {'a':1, 'b': 1} **or** {'a': 0, 'b': 0}
 * @param {object} [options.fields] **Deprecated** Use `options.projection` instead
 * @param {number} [options.skip=0] Set to skip N documents ahead in your query (useful for pagination).
 * @param {object} [options.hint] Tell the query to use specific indexes in the query. Object of indexes to use, {'_id':1}
 * @param {boolean} [options.explain=false] Explain the query instead of returning the data.
 * @param {boolean} [options.snapshot=false] DEPRECATED: Snapshot query.
 * @param {boolean} [options.timeout=false] Specify if the cursor can timeout.
 * @param {boolean} [options.tailable=false] Specify if the cursor is tailable.
 * @param {boolean} [options.awaitData=false] Specify if the cursor is a a tailable-await cursor. Requires `tailable` to be true
 * @param {number} [options.batchSize=1000] Set the batchSize for the getMoreCommand when iterating over the query results.
 * @param {boolean} [options.returnKey=false] Only return the index key.
 * @param {number} [options.maxScan] DEPRECATED: Limit the number of items to scan.
 * @param {number} [options.min] Set index bounds.
 * @param {number} [options.max] Set index bounds.
 * @param {boolean} [options.showDiskLoc=false] Show disk location of results.
 * @param {string} [options.comment] You can put a $comment field on a query to make looking in the profiler logs simpler.
 * @param {boolean} [options.raw=false] Return document results as raw BSON buffers.
 * @param {boolean} [options.promoteLongs=true] Promotes Long values to number if they fit inside the 53 bits resolution.
 * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
 * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
 * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {boolean} [options.partial=false] Specify if the cursor should return partial results when querying against a sharded system
 * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
 * @param {number} [options.maxAwaitTimeMS] The maximum amount of time for the server to wait on new documents to satisfy a tailable cursor query. Requires `taiable` and `awaitData` to be true
 * @param {boolean} [options.noCursorTimeout] The server normally times out idle cursors after an inactivity period (10 minutes) to prevent excess memory use. Set this option to prevent that.
 * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
 * @param {boolean} [options.allowDiskUse] Enables writing to temporary files on the server.
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @throws {MongoError}
 * @returns {Cursor}
 */
Collection.prototype.find = deprecateOptions(
  {
    name: 'collection.find',
    deprecatedOptions: DEPRECATED_FIND_OPTIONS,
    optionsIndex: 1
  },
  function (this: any, query: any, options: any) {
    if (arguments.length > 2) {
      throw new TypeError('Third parameter to `collection.find()` must be undefined');
    }
    if (typeof query === 'function') {
      throw new TypeError('`query` parameter must not be function');
    }
    if (typeof options === 'function') {
      throw new TypeError('`options` parameter must not be function');
    }

    let selector =
      query !== null && typeof query === 'object' && Array.isArray(query) === false ? query : {};

    // Validate correctness off the selector
    const object = selector;
    if (Buffer.isBuffer(object)) {
      const object_size = object[0] | (object[1] << 8) | (object[2] << 16) | (object[3] << 24);
      if (object_size !== object.length) {
        const error = new Error(
          'query selector raw message size does not match message header size [' +
            object.length +
            '] != [' +
            object_size +
            ']'
        );
        error.name = 'MongoError';
        throw error;
      }
    }

    // Check special case where we are using an objectId
    if (selector != null && selector._bsontype === 'ObjectID') {
      selector = { _id: selector };
    }

    if (!options) options = {};

    let projection = options.projection || options.fields;

    if (projection && !Buffer.isBuffer(projection) && Array.isArray(projection)) {
      projection = projection.length
        ? projection.reduce((result: any, field: any) => {
            result[field] = 1;
            return result;
          }, {})
        : { _id: 1 };
    }

    // Make a shallow copy of options
    let newOptions = Object.assign({}, options);

    // Make a shallow copy of the collection options
    for (let key in this.s.options) {
      if (mergeKeys.indexOf(key) !== -1) {
        newOptions[key] = this.s.options[key];
      }
    }

    // Unpack options
    newOptions.skip = options.skip ? options.skip : 0;
    newOptions.limit = options.limit ? options.limit : 0;
    newOptions.raw = typeof options.raw === 'boolean' ? options.raw : this.s.raw;
    newOptions.hint =
      options.hint != null ? normalizeHintField(options.hint) : this.s.collectionHint;
    newOptions.timeout = typeof options.timeout === 'undefined' ? undefined : options.timeout;
    // // If we have overridden slaveOk otherwise use the default db setting
    newOptions.slaveOk = options.slaveOk != null ? options.slaveOk : this.s.db.slaveOk;

    // Add read preference if needed
    newOptions.readPreference = ReadPreference.resolve(this, newOptions);

    // Set slave ok to true if read preference different from primary
    if (
      newOptions.readPreference != null &&
      (newOptions.readPreference !== 'primary' || newOptions.readPreference.mode !== 'primary')
    ) {
      newOptions.slaveOk = true;
    }

    // Ensure the query is an object
    if (selector != null && typeof selector !== 'object') {
      throw MongoError.create({ message: 'query selector must be an object', driver: true });
    }

    // Build the find command
    const findCommand = {
      find: this.s.namespace.toString(),
      limit: newOptions.limit,
      skip: newOptions.skip,
      query: selector
    } as any;

    if (typeof options.allowDiskUse === 'boolean') {
      findCommand.allowDiskUse = options.allowDiskUse;
    }

    // Ensure we use the right await data option
    if (typeof newOptions.awaitdata === 'boolean') {
      newOptions.awaitData = newOptions.awaitdata;
    }

    // Translate to new command option noCursorTimeout
    if (typeof newOptions.timeout === 'boolean') newOptions.noCursorTimeout = newOptions.timeout;

    decorateCommand(findCommand, newOptions, ['session', 'collation']);

    if (projection) findCommand.fields = projection;

    // Add db object to the new options
    newOptions.db = this.s.db;

    // Set raw if available at collection level
    if (newOptions.raw == null && typeof this.s.raw === 'boolean') newOptions.raw = this.s.raw;
    // Set promoteLongs if available at collection level
    if (newOptions.promoteLongs == null && typeof this.s.promoteLongs === 'boolean')
      newOptions.promoteLongs = this.s.promoteLongs;
    if (newOptions.promoteValues == null && typeof this.s.promoteValues === 'boolean')
      newOptions.promoteValues = this.s.promoteValues;
    if (newOptions.promoteBuffers == null && typeof this.s.promoteBuffers === 'boolean')
      newOptions.promoteBuffers = this.s.promoteBuffers;

    // Sort options
    if (findCommand.sort) {
      findCommand.sort = formattedOrderClause(findCommand.sort);
    }

    // Set the readConcern
    decorateWithReadConcern(findCommand, this, options);

    // Decorate find command with collation options

    decorateWithCollation(findCommand, this, options);

    const cursor = new Cursor(
      this.s.topology,
      new FindOperation(this, this.s.namespace, findCommand, newOptions),
      newOptions
    );

    return cursor;
  }
);

/**
 * @typedef {object} Collection~WriteOpResult
 * @property {object[]} ops All the documents inserted using insertOne/insertMany/replaceOne. Documents contain the _id field if forceServerObjectId == false for insertOne/insertMany
 * @property {object} connection The connection object used for the operation.
 * @property {object} result The command result object.
 */

/**
 * The callback format for inserts
 *
 * @callback Collection~writeOpCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Collection~WriteOpResult} result The result object if the command was executed successfully.
 */

/**
 * @typedef {object} Collection~insertWriteOpResult
 * @property {number} insertedCount The total amount of documents inserted.
 * @property {object[]} ops All the documents inserted using insertOne/insertMany/replaceOne. Documents contain the _id field if forceServerObjectId == false for insertOne/insertMany
 * @property {object.<number, ObjectId>} insertedIds Map of the index of the inserted document to the id of the inserted document.
 * @property {object} connection The connection object used for the operation.
 * @property {object} result The raw command result object returned from MongoDB (content might vary by server version).
 * @property {number} result.ok Is 1 if the command executed correctly.
 * @property {number} result.n The total count of documents inserted.
 */

/**
 * @typedef {object} Collection~insertOneWriteOpResult
 * @property {number} insertedCount The total amount of documents inserted.
 * @property {object[]} ops All the documents inserted using insertOne/insertMany/replaceOne. Documents contain the _id field if forceServerObjectId == false for insertOne/insertMany
 * @property {ObjectId} insertedId The driver generated ObjectId for the insert operation.
 * @property {object} connection The connection object used for the operation.
 * @property {object} result The raw command result object returned from MongoDB (content might vary by server version).
 * @property {number} result.ok Is 1 if the command executed correctly.
 * @property {number} result.n The total count of documents inserted.
 */

/**
 * The callback format for inserts
 *
 * @callback Collection~insertWriteOpCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Collection~insertWriteOpResult} result The result object if the command was executed successfully.
 */

/**
 * The callback format for inserts
 *
 * @callback Collection~insertOneWriteOpCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Collection~insertOneWriteOpResult} result The result object if the command was executed successfully.
 */

/**
 * Inserts a single document or a an array of documents into MongoDB. If documents passed in do not contain the **_id** field,
 * one will be added to each of the documents missing it by the driver, mutating the document. This behavior
 * can be overridden by setting the **forceServerObjectId** flag.
 *
 * @function
 * @param {(object|object[])} docs Documents to insert.
 * @param {object} [options] Optional settings.
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.serializeFunctions=false] Serialize functions on any object.
 * @param {boolean} [options.forceServerObjectId=false] Force server to assign _id values instead of driver.
 * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~insertWriteOpCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated Use insertOne, insertMany or bulkWrite
 */
Collection.prototype.insert = deprecate(function (
  this: any,
  docs: any,
  options: any,
  callback: Callback
) {
  if (typeof options === 'function') (callback = options), (options = {});
  options = options || { ordered: false };
  docs = !Array.isArray(docs) ? [docs] : docs;

  if (options.keepGoing === true) {
    options.ordered = false;
  }

  return this.insertMany(docs, options, callback);
},
'collection.insert is deprecated. Use insertOne, insertMany or bulkWrite instead.');

/**
 * Updates documents.
 *
 * @function
 * @param {object} selector The selector for the update operation.
 * @param {object} update The update operations to be applied to the documents
 * @param {object} [options] Optional settings.
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.upsert=false] Update operation is an upsert.
 * @param {boolean} [options.multi=false] Update one/all documents with operation.
 * @param {boolean} [options.bypassDocumentValidation=false] Allow driver to bypass schema validation in MongoDB 3.2 or higher.
 * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
 * @param {Array} [options.arrayFilters] optional list of array filters referenced in filtered positional operators
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {object} [options.hint] An optional hint for query optimization. See the {@link https://docs.mongodb.com/manual/reference/command/update/#update-command-hint|update command} reference for more information.
 * @param {Collection~writeOpCallback} [callback] The command result callback
 * @throws {MongoError}
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated use updateOne, updateMany or bulkWrite
 */
Collection.prototype.update = deprecate(function (
  this: any,
  selector: any,
  update: any,
  options: any,
  callback: Callback
) {
  if (typeof options === 'function') (callback = options), (options = {});
  options = options || {};

  // Add ignoreUndefined
  if (this.s.options.ignoreUndefined) {
    options = Object.assign({}, options);
    options.ignoreUndefined = this.s.options.ignoreUndefined;
  }

  return this.updateMany(selector, update, options, callback);
},
'collection.update is deprecated. Use updateOne, updateMany, or bulkWrite instead.');

Collection.prototype.removeOne = Collection.prototype.deleteOne;
Collection.prototype.removeMany = Collection.prototype.deleteMany;

/**
 * Remove documents.
 *
 * @function
 * @param {object} selector The selector for the update operation.
 * @param {object} [options] Optional settings.
 * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.single=false] Removes the first document found.
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~writeOpCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated use deleteOne, deleteMany or bulkWrite
 */
Collection.prototype.remove = deprecate(function (
  this: any,
  selector: any,
  options: any,
  callback: Callback
) {
  if (typeof options === 'function') (callback = options), (options = {});
  options = options || {};

  // Add ignoreUndefined
  if (this.s.options.ignoreUndefined) {
    options = Object.assign({}, options);
    options.ignoreUndefined = this.s.options.ignoreUndefined;
  }

  return this.deleteMany(selector, options, callback);
},
'collection.remove is deprecated. Use deleteOne, deleteMany, or bulkWrite instead.');

/**
 * The callback format for results
 *
 * @callback Collection~resultCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {object} result The result object if the command was executed successfully.
 */

/**
 * The callback format for an aggregation call
 *
 * @callback Collection~aggregationCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {AggregationCursor} cursor The cursor if the aggregation command was executed successfully.
 */

/**
 * Fetches the first document that matches the query
 *
 * @function
 * @param {object} query Query for find Operation
 * @param {object} [options] Optional settings.
 * @param {number} [options.limit=0] Sets the limit of documents returned in the query.
 * @param {(Array|object)} [options.sort] Set to sort the documents coming back from the query. Array of indexes, [['a', 1]] etc.
 * @param {object} [options.projection] The fields to return in the query. Object of fields to include or exclude (not both), {'a':1}
 * @param {object} [options.fields] **Deprecated** Use `options.projection` instead
 * @param {number} [options.skip=0] Set to skip N documents ahead in your query (useful for pagination).
 * @param {object} [options.hint] Tell the query to use specific indexes in the query. Object of indexes to use, {'_id':1}
 * @param {boolean} [options.explain=false] Explain the query instead of returning the data.
 * @param {boolean} [options.snapshot=false] DEPRECATED: Snapshot query.
 * @param {boolean} [options.timeout=false] Specify if the cursor can timeout.
 * @param {boolean} [options.tailable=false] Specify if the cursor is tailable.
 * @param {number} [options.batchSize=1] Set the batchSize for the getMoreCommand when iterating over the query results.
 * @param {boolean} [options.returnKey=false] Only return the index key.
 * @param {number} [options.maxScan] DEPRECATED: Limit the number of items to scan.
 * @param {number} [options.min] Set index bounds.
 * @param {number} [options.max] Set index bounds.
 * @param {boolean} [options.showDiskLoc=false] Show disk location of results.
 * @param {string} [options.comment] You can put a $comment field on a query to make looking in the profiler logs simpler.
 * @param {boolean} [options.raw=false] Return document results as raw BSON buffers.
 * @param {boolean} [options.promoteLongs=true] Promotes Long values to number if they fit inside the 53 bits resolution.
 * @param {boolean} [options.promoteValues=true] Promotes BSON values to native types where possible, set to false to only receive wrapper types.
 * @param {boolean} [options.promoteBuffers=false] Promotes Binary BSON values to native Node Buffers.
 * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {boolean} [options.partial=false] Specify if the cursor should return partial results when querying against a sharded system
 * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
 * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~resultCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 */
Collection.prototype.findOne = deprecateOptions(
  {
    name: 'collection.find',
    deprecatedOptions: DEPRECATED_FIND_OPTIONS,
    optionsIndex: 1
  },
  function (this: any, query: any, options: any, callback: Callback) {
    if (callback !== undefined && typeof callback !== 'function') {
      throw new TypeError('Third parameter to `findOne()` must be a callback or undefined');
    }

    if (typeof query === 'function') (callback = query), (query = {}), (options = {});
    if (typeof options === 'function') (callback = options), (options = {});
    query = query || {};
    options = options || {};

    return executeOperation(this.s.topology, new FindOneOperation(this, query, options), callback);
  }
);

/**
 * Drops all indexes from this collection.
 *
 * @function
 * @deprecated use dropIndexes
 * @param {Collection~resultCallback} callback The command result callback
 * @returns {Promise<void> | void} returns Promise if no [callback] passed
 */
Collection.prototype.dropAllIndexes = deprecate(
  Collection.prototype.dropIndexes,
  'collection.dropAllIndexes is deprecated. Use dropIndexes instead.'
);

/**
 * Ensures that an index exists, if it does not it creates it
 *
 * @function
 * @deprecated use createIndexes instead
 * @param {(string|object)} fieldOrSpec Defines the index.
 * @param {object} [options] Optional settings.
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.unique=false] Creates an unique index.
 * @param {boolean} [options.sparse=false] Creates a sparse index.
 * @param {boolean} [options.background=false] Creates the index in the background, yielding whenever possible.
 * @param {boolean} [options.dropDups=false] A unique index cannot be created on a key that has pre-existing duplicate values. If you would like to create the index anyway, keeping the first document the database indexes and deleting all subsequent documents that have duplicate value
 * @param {number} [options.min] For geospatial indexes set the lower bound for the co-ordinates.
 * @param {number} [options.max] For geospatial indexes set the high bound for the co-ordinates.
 * @param {number} [options.v] Specify the format version of the indexes.
 * @param {number} [options.expireAfterSeconds] Allows you to expire data on indexes applied to a data (MongoDB 2.2 or higher)
 * @param {number} [options.name] Override the autogenerated index name (useful if the resulting name is larger than 128 bytes)
 * @param {object} [options.collation] Specify collation (MongoDB 3.4 or higher) settings for update operation (see 3.4 documentation for available fields).
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~resultCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 */
Collection.prototype.ensureIndex = deprecate(function (
  this: any,
  fieldOrSpec: any,
  options: any,
  callback: Callback
) {
  if (typeof options === 'function') (callback = options), (options = {});
  options = options || {};

  return executeOperation(
    this.s.topology,
    new EnsureIndexOperation(this.s.db, this.collectionName, fieldOrSpec, options),
    callback
  );
},
'collection.ensureIndex is deprecated. Use createIndexes instead.');

/**
 * The callback format for results
 *
 * @callback Collection~countCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {number} result The count of documents that matched the query.
 */

/**
 * An estimated count of matching documents in the db to a query.
 *
 * **NOTE:** This method has been deprecated, since it does not provide an accurate count of the documents
 * in a collection. To obtain an accurate count of documents in the collection, use {@link Collection#countDocuments countDocuments}.
 * To obtain an estimated count of all documents in the collection, use {@link Collection#estimatedDocumentCount estimatedDocumentCount}.
 *
 * @function
 * @param {object} [query={}] The query for the count.
 * @param {object} [options] Optional settings.
 * @param {object} [options.collation] Specify collation settings for operation. See {@link https://docs.mongodb.com/manual/reference/command/aggregate|aggregation documentation}.
 * @param {boolean} [options.limit] The limit of documents to count.
 * @param {boolean} [options.skip] The number of documents to skip for the count.
 * @param {string} [options.hint] An index name hint for the query.
 * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {number} [options.maxTimeMS] Number of milliseconds to wait before aborting the query.
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~countCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated use {@link Collection#countDocuments countDocuments} or {@link Collection#estimatedDocumentCount estimatedDocumentCount} instead
 */
Collection.prototype.count = deprecate(function (
  this: any,
  query: any,
  options: any,
  callback: Callback
) {
  const args = Array.prototype.slice.call(arguments, 0);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  query = args.length ? args.shift() || {} : {};
  options = args.length ? args.shift() || {} : {};

  if (typeof options === 'function') (callback = options), (options = {});
  options = options || {};

  return executeOperation(
    this.s.topology,
    new EstimatedDocumentCountOperation(this, query, options),
    callback
  );
},
'collection.count is deprecated, and will be removed in a future version.' + ' Use Collection.countDocuments or Collection.estimatedDocumentCount instead');

/**
 * Find and update a document.
 *
 * @function
 * @param {object} query Query object to locate the object to modify.
 * @param {Array} sort If multiple docs match, choose the first one in the specified sort order as the object to manipulate.
 * @param {object} doc The fields/vals to be updated.
 * @param {object} [options] Optional settings.
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {boolean} [options.remove=false] Set to true to remove the object before returning.
 * @param {boolean} [options.upsert=false] Perform an upsert operation.
 * @param {boolean} [options.new=false] Set to true if you want to return the modified object rather than the original. Ignored for remove.
 * @param {object} [options.projection] Object containing the field projection for the result returned from the operation.
 * @param {object} [options.fields] **Deprecated** Use `options.projection` instead
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Array} [options.arrayFilters] optional list of array filters referenced in filtered positional operators
 * @param {Collection~findAndModifyCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead
 */
Collection.prototype.findAndModify = deprecate(
  _findAndModify,
  'collection.findAndModify is deprecated. Use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead.'
);

Collection.prototype._findAndModify = _findAndModify;

function _findAndModify(
  this: any,
  query: any,
  sort: any,
  doc: any,
  options: any,
  callback: Callback
) {
  const args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  sort = args.length ? args.shift() || [] : [];
  doc = args.length ? args.shift() : null;
  options = args.length ? args.shift() || {} : {};

  // Clone options
  options = Object.assign({}, options);
  // Force read preference primary
  options.readPreference = ReadPreference.PRIMARY;

  return executeOperation(
    this.s.topology,
    new FindAndModifyOperation(this, query, sort, doc, options),
    callback
  );
}

/**
 * Find and remove a document.
 *
 * @function
 * @param {object} query Query object to locate the object to modify.
 * @param {Array} sort If multiple docs match, choose the first one in the specified sort order as the object to manipulate.
 * @param {object} [options] Optional settings.
 * @param {(number|string)} [options.w] The write concern.
 * @param {number} [options.wtimeout] The write concern timeout.
 * @param {boolean} [options.j=false] Specify a journal write concern.
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~resultCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated use findOneAndDelete instead
 */
Collection.prototype.findAndRemove = deprecate(function (
  this: any,
  query: any,
  sort: any,
  options: any,
  callback: Callback
) {
  const args = Array.prototype.slice.call(arguments, 1);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  sort = args.length ? args.shift() || [] : [];
  options = args.length ? args.shift() || {} : {};

  // Add the remove option
  options.remove = true;

  return executeOperation(
    this.s.topology,
    new FindAndModifyOperation(this, query, sort, null, options),
    callback
  );
},
'collection.findAndRemove is deprecated. Use findOneAndDelete instead.');

/**
 * Run a group command across a collection
 *
 * @function
 * @param {(object|Array|Function|code)} keys An object, array or function expressing the keys to group by.
 * @param {object} condition An optional condition that must be true for a row to be considered.
 * @param {object} initial Initial value of the aggregation counter object.
 * @param {(Function|Code)} reduce The reduce function aggregates (reduces) the objects iterated
 * @param {(Function|Code)} finalize An optional function to be run on each item in the result set just before the item is returned.
 * @param {boolean} command Specify if you wish to run using the internal group command or using eval, default is true.
 * @param {object} [options] Optional settings.
 * @param {(ReadPreference|string)} [options.readPreference] The preferred read preference (ReadPreference.PRIMARY, ReadPreference.PRIMARY_PREFERRED, ReadPreference.SECONDARY, ReadPreference.SECONDARY_PREFERRED, ReadPreference.NEAREST).
 * @param {ClientSession} [options.session] optional session to use for this operation
 * @param {Collection~resultCallback} [callback] The command result callback
 * @returns {Promise<void> | void} returns Promise if no callback passed
 * @deprecated MongoDB 3.6 or higher no longer supports the group command. We recommend rewriting using the aggregation framework.
 */
Collection.prototype.group = deprecate(function (
  this: any,
  keys: any,
  condition: any,
  initial: any,
  reduce: any,
  finalize: any,
  command: any,
  options: any,
  callback: Callback
) {
  const args = Array.prototype.slice.call(arguments, 3);
  callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
  reduce = args.length ? args.shift() : null;
  finalize = args.length ? args.shift() : null;
  command = args.length ? args.shift() : null;
  options = args.length ? args.shift() || {} : {};

  // Make sure we are backward compatible
  if (!(typeof finalize === 'function')) {
    command = finalize;
    finalize = null;
  }

  if (
    !Array.isArray(keys) &&
    keys instanceof Object &&
    typeof keys !== 'function' &&
    !(keys._bsontype === 'Code')
  ) {
    keys = Object.keys(keys);
  }

  if (typeof reduce === 'function') {
    reduce = reduce.toString();
  }

  if (typeof finalize === 'function') {
    finalize = finalize.toString();
  }

  // Set up the command as default
  command = command == null ? true : command;

  if (command == null) {
    return executeOperation(
      this.s.topology,
      new EvalGroupOperation(this, keys, condition, initial, reduce, finalize, options),
      callback
    );
  }

  return executeOperation(
    this.s.topology,
    new GroupOperation(this, keys, condition, initial, reduce, finalize, options),
    callback
  );
},
'MongoDB 3.6 or higher no longer supports the group command. We recommend rewriting using the aggregation framework.');
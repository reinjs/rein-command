const path = require('path');
const compose = require('koa-compose');
const { EventEmitter } = require('async-events-listener');
const Router = require('ys-middleware-router');
const YsDbo = require('ys-dbo');
const { format, encode, decode, commandEncode, commandDecode } = require('./argv');
//maxListeners
module.exports = class Commander extends EventEmitter {
  constructor(cwd) {
    super();
    this.cwd = cwd;
    this.middleware = [];
    this.configs = [];
    this._maxListeners = 10;
    this._closed = false;
    this._version = '0.0.0';
    this.env = process.env.NODE_ENV || 'development';
    this.router = new Router();
    ['error', 'rejectionHandled', 'uncaughtException', 'unhandledRejection'].forEach(errorType => process.on(errorType, e => this._error(e)));
    ['SIGINT', 'SIGTERM'].forEach(type => process.on(type, e => this._exit().then(() => {
      this._closed = true;
      process.exit(0);
    }))).catch(e => this._error(e));
    this.router.use('/', async (ctx, next) => {
      if (ctx.params) {
        for (const param in ctx.params) {
          ctx.params[param] = commandDecode(ctx.params[param]);
        }
      }
      await next();
    });
  }
  
  setMaxListeners(n) {
    this._maxListeners = n;
    return this;
  }
  
  version(version) {
    this._version = version;
    return this;
  }
  
  plugin(options) {
    this.configs.push(options);
    return this;
  }
  
  use(...args) {
    this.router.use(encode(args[0]), ...this._transform(args.slice(1)));
    return this;
  }
  
  param(...args) {
    this.router.param(args[0], ...this._transform(args.slice(1)));
    return this;
  }
  
  command(...args) {
    this.router.get(encode(args[0]), ...this._transform(args.slice(1)));
    return this;
  }
  
  listen(argv = process.argv.slice(2)) {
    this.commander = argv.join(' ');
    const { pather, args } = decode(argv.map(arg => commandEncode(arg)));
    this.url = '/' + pather.join('/');
    this.data = format(args);
    this._start()
    .then(() => {
      if (this.status === 900) return;
      process.exit(0);
    })
    .catch(e => this._error(e));
  }
  
  async _start() {
    this.ysdbo = new YsDbo(this.configs);
    await this.ysdbo.connect();
    /**
     * command.option: -v
     * 输出版本号
     */
    this._push(async (ctx, next) => {
      if (ctx.url === '/' && Object.keys(this.data).length === 1 && this.data.v) {
        return console.log(this._version);
      }
      await next();
    });
    this._push(this.ysdbo.way({ error: this._error.bind(this), maxListeners: this._maxListeners }));
    this._push(this.router.routes());
    const fns = compose(this.middleware);
    await fns(this, () => this.emit('404', this.commander));
    if (this.status !== 900) {
      await this._exit();
      this._closed = true
    }
  }
  
  _exit() {
    return Promise.all([this.ysdbo.disconnect(), this.emit('exit')]);
  }
  
  _error(e) {
    this.emit('error', e, this.commander)
    .then(() => {
      if (!this._closed) {
        const promise = this._exit();
        this._closed = true;
        return promise;
      }
    })
    .then(() => process.exit(1))
    .catch(() => process.exit(1));
  }
  
  _push(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    this.middleware.push(fn);
    return this;
  }
  
  _transform(args) {
    const result = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg === 'string' && this.cwd) {
        try{
          result.push(require(path.resolve(this.cwd, arg)));
        } catch(e) {
          this._error(e, this.commander);
          return process.exit(1);
        }
      } else {
        result.push(arg);
      }
    }
    return result;
  }
};
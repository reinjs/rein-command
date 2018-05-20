exports.format = argvs => {
  const result = {};
  for (let i = 0; i < argvs.length; i++) resolveArguments(argvs[i], result);
  return result;
};
exports.encode = str => {
  if (str === '*') return '*';
  return '/' + str.replace(/\s+/g, '/');
};
exports.decode = argvs => {
  const _argv = argvs.slice(0), pather = [], args = [];
  single(0);
  return { pather, args };
  function single(i) {
    const str = _argv[i];
    if (str !== undefined) {
      if (!/^\-/.test(str)) {
        pather.push(str);
        return single(i + 1);
      }
      if (/^\-\-/.test(str)) {
        let _str = str.replace(/^\-\-/, '');
        if (_str.indexOf('=') === -1) _str = _str + '=${true}';
        args.push(_str);
        return single(i + 1);
      }
      if (_argv[i + 1] !== undefined && !/^\-/.test(_argv[i + 1])) {
        args.push(str.replace(/^\-/, '') + '=' + _argv[i + 1]);
        return single(i + 2);
      }
      args.push(str.replace(/^\-/, '') + '=${true}');
      return single(i + 1);
    }
  }
};

function resolveArguments(str, res) {
  const colums = str.split('=');
  const dots = colums[0].split('.');
  if (dots.length === 1) {
    res[dots[0]] = colums[1] === '${true}' ? true : colums[1];
  } else {
    const l = dots.slice(0, -1);
    const r = dots.slice(-1)[0];
    let i = 0, t = res;
    while (i < l.length) {
      const v = l[i];
      if (!t[v]) t[v] = {};
      t = t[v];
      ++i;
    }
    t[r] = colums[1] === '${true}' ? true : colums[1];
  }
}
type NestedRecord<V = any> = {
  [k: string | number]: NestedRecord<V> | V;
};

/**
 * This function create an object from keys, value and then assign to target
 *
 * @param {Object} obj : the target object to be assigned
 * @param {string[]} keys
 * @param {string | number} value
 *
 * @example
 * const source = {}
 * assignNestedKeys(source, ['palette', 'primary'], 'var(--palette-primary)')
 * console.log(source) // { palette: { primary: 'var(--palette-primary)' } }
 *
 * @example
 * const source = { palette: { primary: 'var(--palette-primary)' } }
 * assignNestedKeys(source, ['palette', 'secondary'], 'var(--palette-secondary)')
 * console.log(source) // { palette: { primary: 'var(--palette-primary)', secondary: 'var(--palette-secondary)' } }
 */
export const assignNestedKeys = <
  T extends Record<string, any> | null | undefined | string = NestedRecord,
  Value = any,
>(
  obj: T,
  keys: Array<string>,
  value: Value,
  arrayKeys: Array<string> = [],
) => {
  let temp: T = obj;
  keys.forEach((k, index) => {
    if (index === keys.length - 1) {
      if (Array.isArray(temp)) {
        temp[Number(k)] = value;
      } else if (temp && typeof temp === 'object') {
        temp[k] = value;
      }
    } else if (temp && typeof temp === 'object') {
      if (!temp[k]) {
        temp[k] = arrayKeys.includes(k) ? [] : {};
      }
      temp = temp[k];
    }
  });
};

/**
 *
 * @param {Object} obj : source object
 * @param {Function} callback : a function that will be called when
 *                   - the deepest key in source object is reached
 *                   - the value of the deepest key is NOT `undefined` | `null`
 *
 * @example
 * walkObjectDeep({ palette: { primary: { main: '#000000' } } }, console.log)
 * // ['palette', 'primary', 'main'] '#000000'
 */
export const walkObjectDeep = <Value, T = Record<string, any>>(
  obj: T,
  callback: (keys: Array<string>, value: Value, arrayKeys: Array<string>) => void,
  shouldSkipPaths?: (keys: Array<string>) => boolean,
) => {
  function recurse(object: any, parentKeys: Array<string> = [], arrayKeys: Array<string> = []) {
    Object.entries(object).forEach(([key, value]: [string, any]) => {
      if (!shouldSkipPaths || (shouldSkipPaths && !shouldSkipPaths([...parentKeys, key]))) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && Object.keys(value).length > 0) {
            recurse(
              value,
              [...parentKeys, key],
              Array.isArray(value) ? [...arrayKeys, key] : arrayKeys,
            );
          } else {
            callback([...parentKeys, key], value, arrayKeys);
          }
        }
      }
    });
  }
  recurse(obj);
};

const getCssValue = (keys: string[], value: string | number) => {
  if (typeof value === 'number') {
    if (['lineHeight', 'fontWeight', 'opacity', 'zIndex'].some((prop) => keys.includes(prop))) {
      // CSS property that are unitless
      return value;
    }
    const lastKey = keys[keys.length - 1];
    if (lastKey.toLowerCase().indexOf('opacity') >= 0) {
      // opacity values are unitless
      return value;
    }
    return `${value}px`;
  }
  return value;
};

/**
 * a function that parse theme and return { css, vars }
 *
 * @param {Object} theme
 * @param {{
 *  prefix?: string,
 *  shouldSkipGeneratingVar?: (objectPathKeys: Array<string>, value: string | number) => boolean
 * }} options.
 *  `prefix`: The prefix of the generated CSS variables. This function does not change the value.
 *
 * @returns {{ css: Object, vars: Object, parsedTheme: typeof theme }} `css` is the stylesheet, `vars` is an object to get css variable (same structure as theme), and `parsedTheme` is the cloned version of theme.
 *
 * @example
 * const { css, vars, parsedTheme } = parser({
 *   fontSize: 12,
 *   lineHeight: 1.2,
 *   palette: { primary: { 500: 'var(--color)' } }
 * }, { prefix: 'foo' })
 *
 * console.log(css) // { '--foo-fontSize': '12px', '--foo-lineHeight': 1.2, '--foo-palette-primary-500': 'var(--color)' }
 * console.log(vars) // { fontSize: 'var(--foo-fontSize)', lineHeight: 'var(--foo-lineHeight)', palette: { primary: { 500: 'var(--foo-palette-primary-500)' } } }
 * console.log(parsedTheme) // { fontSize: 12, lineHeight: 1.2, palette: { primary: { 500: 'var(--color)' } } }
 */
export default function cssVarsParser<T extends Record<string, any>>(
  theme: T,
  options?: {
    prefix?: string;
    shouldSkipGeneratingVar?: (objectPathKeys: Array<string>, value: string | number) => boolean;
  },
) {
  const { prefix, shouldSkipGeneratingVar } = options || {};
  const css = {} as NestedRecord<string>;
  const vars = {} as NestedRecord<string>;
  const parsedTheme = {} as T;

  walkObjectDeep(
    theme,
    (keys, value: string | number | object, arrayKeys) => {
      if (typeof value === 'string' || typeof value === 'number') {
        if (
          !shouldSkipGeneratingVar ||
          (shouldSkipGeneratingVar && !shouldSkipGeneratingVar(keys, value))
        ) {
          // only create css & var if `shouldSkipGeneratingVar` return false
          const cssVar = `--${prefix ? `${prefix}-` : ''}${keys.join('-')}`;
          Object.assign(css, { [cssVar]: getCssValue(keys, value) });

          assignNestedKeys(vars, keys, `var(${cssVar})`, arrayKeys);
        }
      }
      assignNestedKeys(parsedTheme, keys, value, arrayKeys);
    },
    (keys) => keys[0] === 'vars', // skip 'vars/*' paths
  );

  return { css, vars, parsedTheme };
}

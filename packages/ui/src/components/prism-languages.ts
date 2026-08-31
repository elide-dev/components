import { Prism, type PrismGrammar } from "prism-react-renderer";

/**
 * Extra grammars for the Prism instance vendored by prism-react-renderer, which
 * ships without `bash` or `java`; `pkl` has no upstream grammar at all. Imported
 * for its side effects by CodeBlock.
 *
 * `bash` and `java` are ported from Prism v1.30.0 (https://prismjs.com, MIT ©
 * Lea Verou), with `bun` and `elide` added to bash's known-command list. `pkl`
 * is our own.
 */

interface Tok {
  pattern: RegExp;
  lookbehind?: boolean;
  greedy?: boolean;
  alias?: string;
  inside?: Record<string, unknown> | null;
}
type GrammarDef = Record<string, RegExp | Tok | (RegExp | Tok)[]>;

const register = (name: string, grammar: GrammarDef) => {
  (Prism.languages as Record<string, unknown>)[name] = grammar;
};

// ---------------------------------------------------------------------------
// bash
// ---------------------------------------------------------------------------

// $ set | grep '^[A-Z][^[:space:]]*=' | cut -d= -f1 | tr '\n' '|'
const envVars =
  "\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b";

// Filled with the bash grammar itself once it exists (self-reference).
const commandAfterHeredoc: Tok = {
  pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
  lookbehind: true,
  alias: "punctuation",
  inside: null,
};

const commandSubstitutionInside: Record<string, unknown> = {
  variable: /^\$\(|^`|\)$|`$/,
};

const insideString: Record<string, unknown> = {
  bash: commandAfterHeredoc,
  environment: {
    pattern: RegExp("\\$" + envVars),
    alias: "constant",
  },
  variable: [
    // [0]: Arithmetic Environment
    {
      pattern: /\$?\(\([\s\S]+?\)\)/,
      greedy: true,
      inside: {
        // If there is a $ sign at the beginning highlight $(( and )) as variable
        variable: [
          {
            pattern: /(^\$\(\([\s\S]+)\)\)/,
            lookbehind: true,
          },
          /^\$\(\(/,
        ],
        number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
        operator: /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
        // If there is no $ sign at the beginning highlight (( and )) as punctuation
        punctuation: /\(\(?|\)\)?|,|;/,
      },
    },
    // [1]: Command Substitution
    {
      pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
      greedy: true,
      inside: commandSubstitutionInside,
    },
    // [2]: Brace expansion
    {
      pattern: /\$\{[^}]+\}/,
      greedy: true,
      inside: {
        operator: /:[-=?+]?|[!/]|##?|%%?|\^\^?|,,?/,
        punctuation: /[[\]]/,
        environment: {
          pattern: RegExp("(\\{)" + envVars),
          lookbehind: true,
          alias: "constant",
        },
      },
    },
    /\$(?:\w+|[#?*!@$])/,
  ],
  // Escape sequences from echo and printf's manuals, and escaped quotes.
  entity: /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/,
};

const bash: GrammarDef = {
  shebang: {
    pattern: /^#!\s*\/.*/,
    alias: "important",
  },
  comment: {
    pattern: /(^|[^"{\\$])#.*/,
    lookbehind: true,
  },
  "function-name": [
    // a) function foo {   c) function foo() {
    {
      pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
      lookbehind: true,
      alias: "function",
    },
    // b) foo() {
    {
      pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
      alias: "function",
    },
  ],
  // Highlight variable names as variables in for and select beginnings.
  "for-or-select": {
    pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
    alias: "variable",
    lookbehind: true,
  },
  // Highlight variable names as variables in the left-hand part of assignments.
  "assign-left": {
    pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
    inside: {
      environment: {
        pattern: RegExp("(^|[\\s;|&]|[<>]\\()" + envVars),
        lookbehind: true,
        alias: "constant",
      },
    },
    alias: "variable",
    lookbehind: true,
  },
  // Highlight parameter names as variables
  parameter: {
    pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
    alias: "variable",
    lookbehind: true,
  },
  string: [
    // Here-documents
    {
      pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
      lookbehind: true,
      greedy: true,
      inside: insideString,
    },
    // Here-document with quotes around the tag → no expansion.
    {
      pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
      lookbehind: true,
      greedy: true,
      inside: {
        bash: commandAfterHeredoc,
      },
    },
    // “Normal” string
    {
      pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
      lookbehind: true,
      greedy: true,
      inside: insideString,
    },
    {
      pattern: /(^|[^$\\])'[^']*'/,
      lookbehind: true,
      greedy: true,
    },
    // ANSI-C quoting
    {
      pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
      greedy: true,
      inside: {
        entity: insideString.entity,
      },
    },
  ],
  environment: {
    pattern: RegExp("\\$?" + envVars),
    alias: "constant",
  },
  variable: insideString.variable as (RegExp | Tok)[],
  function: {
    pattern:
      /(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bun|bunx|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|elide|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
    lookbehind: true,
  },
  keyword: {
    pattern: /(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
    lookbehind: true,
  },
  builtin: {
    pattern:
      /(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
    lookbehind: true,
    // Alias added to make those easier to distinguish from strings.
    alias: "class-name",
  },
  boolean: {
    pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
    lookbehind: true,
  },
  "file-descriptor": {
    pattern: /\B&\d\b/,
    alias: "important",
  },
  operator: {
    // Lots of redirections here, but not just that.
    pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
    inside: {
      "file-descriptor": {
        pattern: /^\d/,
        alias: "important",
      },
    },
  },
  punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
  number: {
    pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
    lookbehind: true,
  },
};

commandAfterHeredoc.inside = bash;

// Patterns in command substitution.
for (const name of [
  "comment",
  "function-name",
  "for-or-select",
  "assign-left",
  "parameter",
  "string",
  "environment",
  "function",
  "keyword",
  "builtin",
  "boolean",
  "file-descriptor",
  "operator",
  "punctuation",
  "number",
]) {
  commandSubstitutionInside[name] = bash[name];
}

register("bash", bash);
register("sh", bash);
register("shell", bash);

// ---------------------------------------------------------------------------
// java
// ---------------------------------------------------------------------------

const javaKeywords =
  /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|exports|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record(?!\s*[(){}[\]<>=%~.:,;?+\-*/&|^])|requires|return|sealed|short|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/;

// full package (optional) + parent classes (optional)
const classNamePrefix = /(?:[a-z]\w*\s*\.\s*)*(?:[A-Z]\w*\s*\.\s*)*/.source;

// based on the java naming conventions
const javaClassName: Tok = {
  pattern: RegExp(/(^|[^\w.])/.source + classNamePrefix + /[A-Z](?:[\d_A-Z]*[a-z]\w*)?\b/.source),
  lookbehind: true,
  inside: {
    namespace: {
      pattern: /^[a-z]\w*(?:\s*\.\s*[a-z]\w*)*(?:\s*\.)?/,
      inside: {
        punctuation: /\./,
      },
    },
    punctuation: /\./,
  },
};

const java = Prism.languages.extend("clike", {
  string: {
    pattern: /(^|[^\\])"(?:\\.|[^"\\\r\n])*"/,
    lookbehind: true,
    greedy: true,
  },
  "class-name": [
    javaClassName,
    {
      // variables, parameters, and constructor references
      pattern: RegExp(
        /(^|[^\w.])/.source + classNamePrefix + /[A-Z]\w*(?=\s+\w+\s*[;,=()]|\s*(?:\[[\s,]*\]\s*)?::\s*new\b)/.source,
      ),
      lookbehind: true,
      inside: javaClassName.inside,
    },
    {
      // class names based on keyword
      pattern: RegExp(
        /(\b(?:class|enum|extends|implements|instanceof|interface|new|record|throws)\s+)/.source +
          classNamePrefix +
          /[A-Z]\w*\b/.source,
      ),
      lookbehind: true,
      inside: javaClassName.inside,
    },
  ],
  keyword: javaKeywords,
  function: [
    Prism.languages.clike.function,
    {
      pattern: /(::\s*)[a-z_]\w*/,
      lookbehind: true,
    },
  ],
  number:
    /\b0b[01][01_]*L?\b|\b0x(?:\.[\da-f_p+-]+|[\da-f_]+(?:\.[\da-f_p+-]+)?)\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.\d[\d_]*)(?:e[+-]?\d[\d_]*)?[dfl]?/i,
  operator: {
    pattern: /(^|[^.])(?:<<=?|>>>?=?|->|--|\+\+|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?)/m,
    lookbehind: true,
  },
  constant: /\b[A-Z][A-Z_\d]+\b/,
} as PrismGrammar);

Prism.languages.java = java;

Prism.languages.insertBefore("java", "string", {
  "triple-quoted-string": {
    // http://openjdk.java.net/jeps/355#Description
    pattern: /"""[ \t]*[\r\n](?:(?:"|"")?(?:\\.|[^"\\]))*"""/,
    greedy: true,
    alias: "string",
  },
  char: {
    pattern: /'(?:\\.|[^'\\\r\n]){1,6}'/,
    greedy: true,
  },
} as PrismGrammar);

Prism.languages.insertBefore("java", "class-name", {
  annotation: {
    pattern: /(^|[^.])@\w+(?:\s*\.\s*\w+)*/,
    lookbehind: true,
    alias: "punctuation",
  },
  generics: {
    pattern:
      /<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&)|<(?:[\w\s,.?]|&(?!&))*>)*>)*>)*>/,
    inside: {
      "class-name": javaClassName,
      keyword: javaKeywords,
      punctuation: /[<>(),.:]/,
      operator: /[?&|]/,
    },
  },
  import: [
    {
      pattern: RegExp(/(\bimport\s+)/.source + classNamePrefix + /(?:[A-Z]\w*|\*)(?=\s*;)/.source),
      lookbehind: true,
      inside: {
        namespace: (javaClassName.inside as Record<string, unknown>).namespace,
        punctuation: /\./,
        operator: /\*/,
        "class-name": /\w+/,
      },
    },
    {
      pattern: RegExp(/(\bimport\s+static\s+)/.source + classNamePrefix + /(?:\w+|\*)(?=\s*;)/.source),
      lookbehind: true,
      alias: "static",
      inside: {
        namespace: (javaClassName.inside as Record<string, unknown>).namespace,
        static: /\b\w+$/,
        punctuation: /\./,
        operator: /\*/,
        "class-name": /\w+/,
      },
    },
  ],
  namespace: {
    pattern: RegExp(
      /(\b(?:exports|import(?:\s+static)?|module|open|opens|package|provides|requires|to|transitive|uses|with)\s+)(?!<keyword>)[a-z]\w*(?:\.[a-z]\w*)*\.?/.source.replace(
        /<keyword>/g,
        () => javaKeywords.source,
      ),
    ),
    lookbehind: true,
    inside: {
      punctuation: /\./,
    },
  },
} as PrismGrammar);

// ---------------------------------------------------------------------------
// pkl — https://pkl-lang.org
// ---------------------------------------------------------------------------

const pklInterpolation: Tok = {
  pattern: /\\#{0,3}\((?:[^()]|\([^()]*\))*\)/,
  alias: "variable",
};

const pkl: GrammarDef = {
  comment: [
    { pattern: /\/\/\/.*|\/\/.*/, greedy: true },
    { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
  ],
  "triple-quoted-string": {
    pattern: /#{0,3}"""[\s\S]*?"""#{0,3}/,
    greedy: true,
    alias: "string",
    inside: { interpolation: pklInterpolation },
  },
  string: {
    pattern: /#{0,3}"(?:\\.|[^"\\\r\n])*"#{0,3}/,
    greedy: true,
    inside: { interpolation: pklInterpolation },
  },
  annotation: { pattern: /@\w+/, alias: "builtin" },
  keyword: [
    /\b(?:import|read)[*?]?(?!\w)/,
    /\b(?:abstract|amends|as|class|const|else|extends|external|fixed|for|function|hidden|if|in|is|let|local|module|new|nothing|open|out|outer|super|this|throw|trace|typealias|unknown|when)\b/,
  ],
  boolean: /\b(?:false|null|true)\b/,
  "class-name": /\b[A-Z]\w*\b/,
  function: /\b[a-z_]\w*(?=\s*\()/,
  // property names: `name = ...`, `jvm { ... }`, `port: Int`
  property: {
    pattern: /(^[ \t]*(?:(?:abstract|const|external|fixed|hidden|local)\s+)*)[a-z_]\w*(?=\s*[={:])/m,
    lookbehind: true,
  },
  number: /\b(?:0x[\da-fA-F][\da-fA-F_]*|0b[01][01_]*|0o[0-7][0-7_]*|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)\b/,
  operator: /->|\|>|\?\?|!!|\?\.|\*\*|[=!<>]=?|&&|\|\||[+\-*/%~?]/,
  punctuation: /[{}[\]();,.:]/,
};

register("pkl", pkl);

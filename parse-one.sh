if [[ ! $1 ]]; then
  echo "Missing filename argument"
  exit 111
fi
rm ./grammar.js; $(npm bin)/nearleyc test.ne > grammar.js || (echo "failed to compile" && exit 111)

comamnd_prefix=''
if [[ ${DEBUG} ]]; then
  command_prefix='node --inspect-brk'
fi

if [[ $2 ]]; then
  if [[ ${command_prefix} == '' ]]; then
    command_prefix='node'
  fi
  ${command_prefix} ./parser-test.js "$1"
else
  PHIL_DEBUG=1 ${command_prefix} $(npm bin)/nearley-test --quiet ./grammar.js < $1
fi

if [[ ! $1 ]]; then
  echo "Missing filename argument"
  exit 111
fi
npm run-script compile || (echo "failed to compile" && exit 111)

comamnd_prefix=''
if [[ ${DEBUG} ]]; then
  command_prefix='node --inspect-brk'
fi

if [[ $2 ]]; then
  if [[ ${command_prefix} == '' ]]; then
    command_prefix='node'
  fi
  ${command_prefix} ./lib/nearley-parser/parserTest.js "$1"
else
  PHIL_DEBUG=1 ${command_prefix} $(npm bin)/nearley-test --quiet ./src/nearley-parser/grammar.js < $1
fi

npm run-script compile || (echo "failed to compile" && exit 111)

run_test() {
  filename=$1
  node ./lib/nearley-parser/parserTest.js "${filename}"
  if [[ $? == 0 ]]; then
    echo "UNIQUE PARSE ${filename}"
  elif [[ $? == 1 ]]; then
    echo "STACKTRACE ${filename}"
  elif [[ $? == 111 ]]; then
    echo "UNABLE_TO_PARSE (zero reults) ${filename}"
  elif [[ $? == 112 ]]; then
    echo "AMBIGUOUS_PARSE ${filename}"
  elif [[ $? == 132 ]]; then
    echo "OUTOFMEMORY ${filename}"
  fi
}

# shuffle() {
#    local i tmp size max rand array
#    array=$1
#
#    # $RANDOM % (i+1) is biased because of the limited range of $RANDOM
#    # Compensate by using a range which is a multiple of the array size.
#    size=${#array[*]}
#    max=$(( 32768 / size * size ))
#
#    for ((i=size-1; i>0; i--)); do
#       while (( (rand=$RANDOM) >= max )); do :; done
#       rand=$(( rand % (i+1) ))
#       tmp=${array[i]} array[i]=${array[rand]} array[rand]=$tmp
#    done
# }

unique_games=(
  "gists/_pot-wash-panic_itch/script.txt"
  "gists/_1-2-3-ban_7997709/script.txt"
  "gists/15d26446f96865a51ff886ba3a396b0f/script.txt"
  "gists/1de0fbf0c0fcbcf00d163baac81e6fe9/script.txt"
  "gists/24b22ced6f0eaec88a92a71e429e6f62/script.txt"
  "gists/5b51dfdb2f48ccedec33b0898e54f532/script.txt"
  "gists/5d48437cf5e74ae4fe9fdece55d61a12/script.txt"
  "gists/15d26446f96865a51ff886ba3a396b0f/script.txt"
  "gists/1de0fbf0c0fcbcf00d163baac81e6fe9/script.txt"
  "gists/24b22ced6f0eaec88a92a71e429e6f62/script.txt"
  "gists/332c05c6247230db8b9367b66098bdc8/script.txt"
  "gists/33fa37d571cabb2f0ce8621720654fee/script.txt"
  "gists/406fdfd9e17d9b39bf16f9b6f6071a97/script.txt"
  "gists/5b51dfdb2f48ccedec33b0898e54f532/script.txt"
  "gists/5d48437cf5e74ae4fe9fdece55d61a12/script.txt"
  "gists/08be4edbe4649b9cfbb37daec1264231/script.txt"
  "gists/0134940bf3e905b6a941c510e5c8ec7e/script.txt"
  "gists/1f30ec05343d7bdba25f2baf19de2d87/script.txt"
  "gists/2dce07d164e63b7b5fa5ec211434e68f/script.txt"
  "gists/542b97948cb1d377dce6d276c0bcd9d5/script.txt"
  "gists/6a04b8eea31dd4b71cc3cca079f57ef5/script.txt"
  "gists/6a55dd397340b688cdbef660a253e277/script.txt"
  "gists/6b958e449b7dcb2d1582fe4da343ca97/script.txt"
  "gists/711d6220e4fe2a36254cc544c6ba4885/script.txt"
  "gists/7375ea35efdd23517a4588b9af589e5b/script.txt"
  "gists/760067e42d4c6483e916f9bdc8a3211d/script.txt"
  "gists/7b016ea800043746181f2752e709f452/script.txt"
  "gists/7c7981066d27c48a404f0f378f27aa4f/script.txt"
  "gists/8a488a33aa103b51c1d5e6d893cef01b/script.txt"
  "gists/9e8176e9921983b0b091a6e9496289f3/script.txt"
  "gists/_element-walkers_itch/script.txt"
  "gists/_hack-the-net_8b5eb39cb825277832d261b3142f084b/script.txt"
  "gists/_marcosd.itch.io_feeling-like-filling/script.txt"
  "gists/_oveahlman.itch.io_fatigued-square-maze/script.txt"
  "gists/_random-world-generation_itch/script.txt"
  "gists/_roll-those-sixes-itch/script.txt"
  "gists/_rosden.itch.io_the-art-of-cloning/script.txt"
  "gists/_rosden.itch.io_the-copying/script.txt"
  "gists/_separation_itch/script.txt"
  "gists/_sleepy-player_itch/script.txt"
  "gists/_slime-swap_9631285024cd2945014313840c7c3156/script.txt"
  "gists/_spacekoban_6a6c07f71d7039e4155e/script.txt"
  "gists/_spooky-pumpkin_7242443/script.txt"
  "gists/_stairs-2825915f92c5c3461a3b57e40099de35/script.txt"
  "gists/_train_9bd3b639ce3fec9dc810eb03f4468e77/script.txt"
  "gists/a4829564ab394e720a82cf25d6c9cd91/script.txt"
  "gists/a50bbd6c0fa497e0a83a0f863af47ffd/script.txt"
  "gists/aadbd2316721d3b21e517ed5d6082de4/script.txt"
  "gists/b21cd47f940494b35b84044f49abe188/script.txt"
  "gists/b24072bc0efe2647b03b67fccf0430d1/script.txt"
  "gists/c5ec035de4e0c145a85327942fb76098/script.txt"
  "gists/c7bc452b629eb194ecf7a22665dc1fab/script.txt"
  "gists/d7c7100e28c3cf0e60f8a5f56dabc457/script.txt"
  "gists/dbf240983263bef164e1b5a9403ccc76/script.txt"
  "gists/e1e49e5d33d077bb9865318bbd9857bb/script.txt"
  "gists/e3436267894d2721d9b8ac7a583a5d3b/script.txt"
  "gists/e56c0aa36987c678aa413dd6447642ee/script.txt"
  "gists/e86e1d6cf24307499c1cd1aaaa733a91/script.txt"
  "gists/e923b9b080ce825e256d92fda07f4277/script.txt"
  "gists/f0b9b8e95d0bc87c9fb9e411756daa23/script.txt"
  "gists/f8a148456d4f050bf41837b6999852bf/script.txt"
  "gists/fb4b0867bc3daa6835b9286e59cbcd2c/script.txt"
  "gists/fdd2ede40de0a2877f291cfbc94cf802/script.txt"
  "gists/2364a778ad57da6f781fc35876aa5802/script.txt"
  "gists/31284231cf0de7e92a601532cf5b4fc9/script.txt"
  "gists/372087f4734188ee8bc66acd1360b6e4/script.txt"
  "gists/391852197b1aef15558342df2670d635/script.txt"
  "gists/5e0b61a3d39bc91c597fdbc4d992976f/script.txt"
  "gists/5eda0138c3d852b27b9c5cd3ca11582e/script.txt"
  "gists/69d053ed70273e3dc4bd5a8f684a6a66/script.txt"
  "gists/8645c163ff321d2fd1bad3fcaf48c107/script.txt"
  "gists/149f97b5a78fa1d16870bd31fc070bfe/script.txt"
  "gists/1fd6648425b42fb8ef911ead022a2e4f/script.txt"
  "gists/22a8707b469222e4a7d5/script.txt"
  "gists/23eddce35df509020fa8bf055e69f6b6/script.txt"
  "gists/2b9ece642cd7cdfb4a5f2c9fa8455e40/script.txt"
  "gists/11e4b70206715622bc03cc5cae16e650/script.txt"
  "gists/169d7dd790d3dffc76ca55833a218599/script.txt"
  "gists/16f94921962efc6a0f041e4a4f832850/script.txt"
  "gists/181f370a15625905ca6e844a972a4abf/script.txt"
  "gists/6a5f68904f1cdb4c91904754719d267e/script.txt"
  "gists/839e07e805520591bc5e64c7ecf73409/script.txt"
  "gists/84f7b9dee23e3a8de818f16697adaee5/script.txt"
  "gists/9a1172cfa00cfb1e932514b6f101ef6d/script.txt"
  "gists/9ebe1e5ad44ac22259343de170a3b337/script.txt"
  "gists/_alien-disco_itch/script.txt"
  "gists/_boxes-love-bloxing_c2d717a77f9aa02ecb1b793111f3a921/script.txt"
  "gists/_linked_4183971eb94557d86479d4cced4c3d24/script.txt"
  "gists/_spikes-n-stuff_dc5c4a669e362e389e994025075f7d0b/script.txt"
  "gists/a3fed21da070715a46661c355b4b3d7b/script.txt"
  "gists/a4a1c0b2927b6a9807ea1e80c4b5dc85/script.txt"
  "gists/a55b1a0e2fde091cac69d4401e9f3396/script.txt"
  "gists/b5e53f43cdfa86f92270610cf616a483/script.txt"
  "gists/c2b1a17ffdab0969993336c643dafe6c/script.txt"
  "gists/e293906af7a3057b0f2a191d3e555b41/script.txt"
  "gists/e84f79f2d1980c54149ab9511076367a/script.txt"
  "gists/_finding-my-body-itch/script.txt"
  "gists/ce287e54d968bd582d541b0a0044d61d/script.txt"
  "gists/1984823234d4d11bdf908b2c1eb2af60/script.txt"
  "gists/457c6d8be68ffb6d921211d40ca48c15/script.txt"
  "gists/4e93280ee9933ea9a02caa0b38cc959a/script.txt"
  "gists/5fa6a39d644ac0b4bffd8371b29a5c79/script.txt"
  "gists/6dcb8b956d77a3a7dff4c129c58cfa1f/script.txt"
  "gists/8074d60a0af768f970ef055d4460414d/script.txt"
  "gists/86bfa2b11d7b489dab4d410bdf245f49/script.txt"
  "gists/_broken-airport-agression_bc929f97dfb013a5f62ab58ac2d117c0/script.txt"
  "gists/_cyber-lasso-e3e444f7c63fb21b6ec0/script.txt"
  "gists/_mirror-isles_219a7db6511dad557b84/script.txt"
  "gists/_rosden.itch.io_interconnection/script.txt"
  "gists/4f00d9a8a798fa2ebb0aae488df206a1/script.txt"
  "gists/5e841571fd059992949fe6940bc95475/script.txt"
  "gists/754f6de4a6e6dff47a5004ad40494f77/script.txt"
  "gists/_rosden.itch.io_bomb-n-grouping/script.txt"
  "gists/_rosden.itch.io_bomb-n-ice/script.txt"
  "gists/_rosden.itch.io_chasm/script.txt"
  "gists/_rosden.itch.io_climbing-cubes/script.txt"
  "gists/_rosden.itch.io_compressed/script.txt"
  "gists/_rosden.itch.io_covering-holes/script.txt"
  "gists/_rosden.itch.io_cubes-barrier/script.txt"
  "gists/_rosden.itch.io_cubes-medusa/script.txt"
  "gists/_rosden.itch.io_directional/script.txt"
  "gists/_rosden.itch.io_duality/script.txt"
  "gists/_rosden.itch.io_dup-block/script.txt"
  "gists/_rosden.itch.io_enclosed/script.txt"
  "gists/_rosden.itch.io_extra-lives/script.txt"
  "gists/_rosden.itch.io_fire-in-winter/script.txt"
  "gists/_rosden.itch.io_fuse-to-green/script.txt"
  "gists/_rosden.itch.io_fused-pieces/script.txt"
  "gists/_rosden.itch.io_grouping/script.txt"
  "gists/_rosden.itch.io_guiding-blocks/script.txt"
  "gists/_rosden.itch.io_hue-change/script.txt"
  "gists/_rosden.itch.io_ice-path/script.txt"
  "gists/_rosden.itch.io_inbetween/script.txt"
  "gists/_rosden.itch.io_infected/script.txt"
  "gists/_rosden.itch.io_islands/script.txt"
  "gists/_rosden.itch.io_lights-down/script.txt"
  "gists/_rosden.itch.io_magnetized/script.txt"
  "gists/_rosden.itch.io_monster-mess/script.txt"
  "gists/_rosden.itch.io_moving-target/script.txt"
  "gists/_rosden.itch.io_outward-force/script.txt"
  "gists/_rosden.itch.io_overstep/script.txt"
  "gists/_rosden.itch.io_path-lines/script.txt"
  "gists/_rosden.itch.io_pathmaker/script.txt"
  "gists/_rosden.itch.io_positional/script.txt"
  "gists/_rosden.itch.io_pull-and-push/script.txt"
  "gists/_rosden.itch.io_purple/script.txt"
  "gists/_rosden.itch.io_rows-and-columns/script.txt"
  "gists/_rosden.itch.io_scaling-walls/script.txt"
  "gists/_rosden.itch.io_shifting/script.txt"
  "gists/_rosden.itch.io_skippa/script.txt"
  "gists/_rosden.itch.io_skyscraper/script.txt"
  "gists/_rosden.itch.io_some-pits/script.txt"
  "gists/_rosden.itch.io_square-colours/script.txt"
  "gists/_rosden.itch.io_stalemate-yourself/script.txt"
  "gists/_rosden.itch.io_sticky/script.txt"
  "gists/_rosden.itch.io_swap/script.txt"
  "gists/_rosden.itch.io_teleporters/script.txt"
  "gists/_rosden.itch.io_the-art-of-storage/script.txt"
  "gists/_rosden.itch.io_the-fire-calls*/script.txt"
  "gists/_rosden.itch.io_the-laser/script.txt"
  "gists/_rosden.itch.io_the-packing-crate/script.txt"
  "gists/_rosden.itch.io_the-switch/script.txt"
  "gists/_rosden.itch.io_the-walls-you-leave-behind/script.txt"
  "gists/_rosden.itch.io_then-another/script.txt"
  "gists/_rosden.itch.io_tile-step/script.txt"
  "gists/_rosden.itch.io_to-nothing-and-back/script.txt"
  "gists/_rosden.itch.io_triple-match/script.txt"
  "gists/_rosden.itch.io_using-pushers/script.txt"
  "gists/_rosden.itch.io_wall-bonding/script.txt"
  "gists/_rosden.itch.io_wall-movement/script.txt"
  "gists/_rosden.itch.io_wall-shuffle/script.txt"
  "gists/_rosden.itch.io_white-pillars/script.txt"
  "gists/_skipping-stones_d6fd6fcf84de185e2584/script.txt"
  "gists/_sneeze-a-day_c06feb492ab44b937639/script.txt"
  "gists/_two-and-a-half_newgrounds/script.txt"
  "gists/ab33099802e0e151bbfd3861876da9cb/script.txt"
  "gists/ad997407b1fef4c3ecbea25295376f82/script.txt"
  "gists/b6c8ba9363b4cca270d8ce5e88f79abf/script.txt"
  "gists/c700c4711064b71e6b72c3f5e2dc67ad/script.txt"
  "gists/cbdb2df1e843449b8aec56b7cdae036a/script.txt"
  "gists/d9b67d69437187ab3754a04f68c25b4e/script.txt"
  "gists/e13482e035a5f75e9b0e4d0b5f28f8b6/script.txt"
  "gists/f0c040ee41c3bd3854ff50db8530355d/script.txt"
  "gists/f47cd8a5cb9288f6f2792d37e44c0bfc/script.txt"
  "gists/fa83aa67f2c9fcf1d66200aaedbc762c/script.txt"
  "gists/ff72f059a4b217d130e6ed5f9947646d/script.txt"
  "gists/_tiaradventur_04e9b3dc13d2708e64a0adc4ddb916a0/script.txt"
  "gists/_entanglement/script.txt"
  "gists/_out-of-bounds_4b31e5425f31775057ec1003ff0b4271/script.txt"
  "gists/_rosden.itch.io_symbols/script.txt"
  "gists/6daa8b63cf79202cd085c1b168048c09/script.txt"
  "gists/9e9a2f35fb88e0ebc6bf4ab10c25799e/script.txt"
  "gists/b8cb7c315faf4b28601c7d411fe70993/script.txt"
  "gists/ee39bfe12012c774acfc5e3d32fb4f89/script.txt"
  "gists/fd771bca5a1f6b4023fd2e16811688be/script.txt"
  "gists/_rosden.itch.io_wall-virus/script.txt"
  "gists/7ea61f2862095950611d07cc27015851/script.txt"
  "gists/_rosden.itch.io_consumed-to-1/script.txt"
  "gists/_rosden.itch.io_the-big-dig/script.txt"
  "gists/0b295ce04ed384e7119410495fe2afd7/script.txt"
  "gists/957ca5368ce8c48852b6c353c60f22c0/script.txt"
)

for filename in "${unique_games[@]}"; do
  run_test ${filename}
done

echo "-------------------"
echo " Running all files "
echo "-------------------"

all_games=($(ls -d gists/*/script.txt))

# shuffle all_games
# all_games=( $(shuf -e "${all_games[@]}") )

for filename in "${all_games[@]}"; do
  # Check that we have not already parsed it
  skip=0
  for f2 in "${unique_games[@]}"; do
    if [[ ${f2} == ${filename} ]]; then
      skip=1
      break
    fi
  done

  if [[ ${skip} == 1 ]]; then
    continue
  else
    echo "reading ${filename}"
    run_test ${filename}
  fi
done

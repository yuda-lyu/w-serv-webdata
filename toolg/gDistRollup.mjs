import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
    fns: ['WServWebdataServer.mjs', 'WServWebdataClient.mjs'],
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'path': 'path',
        'fs': 'fs',
        'events': 'events',
    },
    external: [
        'path',
        'fs',
        'events',
    ],
})


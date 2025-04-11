perf:
    perf stat -e instructions,cycles,cache-references,cache-misses,branches,branch-misses node dpath.mjs AndroidManifest.xml 7
CSD 64 supports two offline modes:

1. Automatic offline cache
   Open the hosted app once while online. It downloads the pinned EmulatorJS
   4.2.3 N64 files and stores them in the service-worker cache. Wait until the
   menu reports OFFLINE READY before disconnecting.

2. Physically self-contained deployment
   On a Mac, run MAKE-SELF-CONTAINED.command before uploading the site. It
   downloads only the pinned non-threaded legacy Mupen64Plus-Next files used by
   the iPhone 5s profile into this directory. No runtime CDN is then required.

No ROMs are included.

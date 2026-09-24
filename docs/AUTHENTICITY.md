# Download integrity and provenance / 下载校验与来源

## Current status

Maintainer: https://github.com/Fan-dev-sktch. Use the repository from which you obtained this source. Version 0.5.0 has only been built locally; no publication or cryptographic signing identity is claimed. Brand availability has not been verified.

## Release checks

`npm run release` packages only explicitly listed files. It rejects symbolic links, selected credential patterns and personal home-directory paths in packaged text. This is a limited guard, not a comprehensive secret scanner or an audit of Git history.

Each archive contains `RELEASE-PROVENANCE.json`: package name/version, maintainer identifier, build time and SHA-256 hashes of its packaged files. These are build metadata, not a digital signature or proof of authorship. No machine path, Git email or hostname is included.

Alongside the archive, `dist/SHA256SUMS` contains its SHA-256 checksum. Obtain this checksum from the maintainer's verified release page; a checksum supplied by an untrusted mirror can be replaced along with the download.

Windows archive check:

```powershell
Get-FileHash -Algorithm SHA256 .\spellout-source.tgz
```

Compare the displayed hash to `SHA256SUMS`. After extracting, before installing dependencies:

```sh
node scripts/verify-release.mjs
```

Run the verifier on a fresh extraction: it rejects missing, modified and unexpected files. Installing dependencies or generating local configuration adds files and should happen after verification. As with any script, only execute it after deciding to trust its source.

## What these protections do

- Preserve upstream attribution and distinguish this adaptation's maintainer identity.
- Detect accidental modification or mismatch against a trusted published checksum.
- Reduce accidental disclosure in the downloadable source archive.

They do not prevent copying, authenticate an attacker-supplied archive, prove exclusive ownership, or guarantee the absence of secrets. MIT permissions remain unchanged. A signature or GitHub artifact attestation from a verified maintainer workflow remains a future publication step; neither is currently implemented.

## Before making a repository public

Review the staged files **and all history to be pushed**. Archive allowlists and `.gitignore` do not sanitize tracked files or earlier commits. Keep local settings, private screenshots, conversations and credentials out of the public repository. Retain original license notices. Do not make originality or trademark claims that the evidence does not support.

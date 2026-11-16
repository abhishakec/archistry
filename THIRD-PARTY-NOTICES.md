# Third-party notices

Archistry's own code and documentation are licensed under the [MIT License](LICENSE).
The files listed below are third-party works bundled for convenience. They are **not** covered by
the MIT License; each keeps its owner's copyright and terms.

| Component | Where in this repo | Owner | Terms |
|---|---|---|---|
| Salesforce product, platform, industry and document-type icons | embedded in `assets/icons/catalog.json` | Community [drawIo-Salesforce](https://github.com/ehsky/drawIo-Salesforce) library by [@ehsky](https://github.com/ehsky); the artwork depicts Salesforce, Inc. marks | No licence file is published upstream. Included with attribution; see the note below |
| SLDS icons (standard, utility) | embedded in `assets/icons/catalog.json` | Salesforce, Inc. | [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/), text in [`assets/icons/LICENSE-SLDS-icons.txt`](assets/icons/LICENSE-SLDS-icons.txt). Redistributed unmodified |
| Sora font | `docs/brand/fonts/` (wordmark and banner) | The Sora Project Authors | [SIL Open Font License 1.1](docs/brand/fonts/OFL-Sora.txt) |
| Inter font | `docs/brand/fonts/` (banner) | The Inter Project Authors | [SIL Open Font License 1.1](docs/brand/fonts/OFL-Inter.txt) |
| JetBrains Mono font | `docs/brand/fonts/` (banner) | The JetBrains Mono Project Authors | [SIL Open Font License 1.1](docs/brand/fonts/OFL-JetBrainsMono.txt) |

## Note on the drawIo-Salesforce icons

The upstream repository does not publish a licence. These icons are included in good faith, with
attribution, so diagrams render without installing a shape library. If you are the owner and want
them removed or credited differently, please open an issue and it will be done promptly.

If your organisation needs a strictly licence-clean distribution, remove the `product/`,
`platform/`, `industry/` and `doctype/` entries from `assets/icons/catalog.json`. Diagrams still
build; affected boxes render as plain cards.

## Trademarks

Salesforce, Agentforce, Data Cloud, MuleSoft, Tableau, Slack and related marks are trademarks of
Salesforce, Inc. Their appearance in icons does not imply endorsement. Archistry is an unofficial
community project and is not affiliated with Salesforce, Inc.

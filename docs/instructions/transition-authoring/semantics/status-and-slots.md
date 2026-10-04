# Status and slots

`data-flemo-active` follows the stack, not travel direction. Select pose slots using this table.

| status | active | Screen role | Screen slot | Morph slot | Part slot | Decorator slot |
| --- | --- | --- | --- | --- | --- | --- |
| PUSHING | true | arriving, new top | `enter` | `enter`, moves | `idle` | `idle` |
| PUSHING | false | covered, going behind | `exit` | `exit`, cut | `enter` | `enter` |
| REPLACING | true | arriving | `enter` | `enter`, moves | `idle` | `idle` |
| REPLACING | false | leaving | `exit` | `exit`, cut | `enter` | `enter` |
| POPPING | true | being dismissed, still top | `enterBack` | `exit`, cut | `dismiss`, else `idle` | `idle` |
| POPPING | false | returning, underneath | `exitBack` | `enter`, moves | `exit` | `exit` |
| COMPLETED | true | settled active | `enter` | `idle` | `idle` | `idle` |
| COMPLETED | false | settled behind | `exit` | `idle` | `enter` | `enter` |

- `enterBack` is the active screen leaving on pop. In `cupertino`, it is `x: "100%"`.
- Interpreting `active === "true"` as arrival pairs morphs backwards on every pop.

/goal Design a lightweight ORI content CMS for administrators/teachers.

Needs:
- create/edit/draft/publish vocabulary
- create/edit/draft/publish grammar
- create/edit/draft/publish listening
- create/edit/draft/publish reading
- import structured CSV/JSON
- preview before publish
- validation errors
- audit-friendly updated_at / updated_by where feasible

Constraints:
- existing student data must remain compatible
- content publishing must be explicit
- teachers must not gain unrestricted admin account-management powers unless assigned
- preserve RLS
- avoid vendor lock-in where possible

Begin with a written migration plan. Do not immediately implement every editor.

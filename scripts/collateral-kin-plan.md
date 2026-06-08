# Collateral Kin Visibility Plan

Category terms:
- collateral_relative
- parent_sibling
- paternal_aunt / paternal_uncle
- maternal_aunt / maternal_uncle
- sibling_group
- extended_kin

Rule:
For the authenticated member, find parents. For each parent, find all nodes sharing that parent's parent_ids. Exclude the parent. Those records are the parent's brothers and sisters.

Views:
- Parent View: self + parents only.
- Household View: self + spouse + children.
- Pedigree/Fan: direct ancestors only.
- Kinship View: self, parents, siblings, spouse, children, aunts/uncles, cousins, household.

Do not delete or hide collateral relatives. If not shown in pedigree/fan, keep them visible in Kinship View and person detail.

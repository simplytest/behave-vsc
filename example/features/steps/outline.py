from behave import given, when, then
from hamcrest import assert_that, equal_to

@given('I put "{thing}" in a blender')
def step_given_put_thing_into_blender(context, thing):
    context.thing = thing

transformation = {
    "thing": "other thing",
    "Red Tree Frog": "mush",
    "apples": "apple juice",
    "iPhone": "toxic waste",
    "Galaxy Nexus": "whoops"
}

@when('I switch the blender on')
def step_when_switch_blender_on(context):
    context.thing = transformation[context.thing]
    

@then('it should transform into "{other_thing}"')
def step_then_should_transform_into(context, other_thing):
    assert_that(context.thing, equal_to(other_thing))

from behave import when, then

@when(u'I type in "{}"')
def step_impl(context, text):
    context.data = text
    print("Some console output!")

@then(u'It should print "{}"')
def step_impl(context, text):
    if context.data != text:
        raise RuntimeError(f"Text mismatch: {context.data} != {text}")

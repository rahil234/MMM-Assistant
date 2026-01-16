from ollama import chat

def get_temperature(city: str) -> str:
  """Get the current temperature for a city

  Args:
    city: The name of the city

  Returns:
    The current temperature for the city
  """
  temperatures = {
    "New York": "22°C",
    "London": "15°C",
    "Tokyo": "18°C"
  }
  return temperatures.get(city, "Unknown")

def get_conditions(city: str) -> str:
  """Get the current weather conditions for a city

  Args:
    city: The name of the city

  Returns:
    The current weather conditions for the city
  """
  conditions = {
    "New York": "Partly cloudy",
    "London": "Rainy",
    "Tokyo": "Sunny"
  }
  return conditions.get(city, "Unknown")

def control(entity: str) -> bool:
  """Control a smart home device

  Args:
    entity: The name of the smart home device

  Returns:
    Whether the device was successfully controlled
  """

  print(f"Turning on {entity}")

  return False

messages = [{'role': 'user', 'content': 'Turn on the lights'}]

# The python client automatically parses functions as a tool schema so we can pass them directly
# Schemas can be passed directly in the tools list as well
response = chat(model='llama3.1:8b', messages=messages, tools=[control])

# add the assistant message to the messages
messages.append(response.message)
if response.message.tool_calls:
  # process each tool call
  for call in response.message.tool_calls:
    # execute the appropriate tool
    if call.function.name == 'get_temperature':
      result = get_temperature(**call.function.arguments)
    elif call.function.name == 'get_conditions':
      result = get_conditions(**call.function.arguments)
    elif call.function.name == 'control':
      result = control(**call.function.arguments)
    else:
      result = 'Unknown tool'
    # add the tool result to the messages
    messages.append({'role': 'tool',  'tool_name': call.function.name, 'content': str(result)})

  # generate the final response
  final_response = chat(model='llama3.1:8b', messages=messages, tools=[control])
  print(final_response.message.content)

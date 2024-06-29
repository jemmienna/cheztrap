import requests
from bs4 import BeautifulSoup

page_to_scrape = requests.get('https://quotes.toscrape.com/')
soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

quotes = soup.findAll("span", attrs={"class":"text"})
authors = soup.findAll("small", attrs={"class":"author"})

quotes_with_authors = []
for quote, author in zip (quotes, authors):
    quotes_with_authors.append(quote.text + " - " + author.text)
print(quotes_with_authors)
